const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// 仅允许学员角色访问的中间件（防止管理员账号误当学员使用）
function requireMember(req, res, next) {
  if (!req.user || req.user.role !== "member") {
    return res.status(403).json({
      message: "仅学员账号可以访问此功能，请使用学员账号登录前台购买课程或学习。",
    });
  }
  next();
}

// 初始化学员课程表、订单表、学习进度与成就表
async function initMemberTables() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        source ENUM('free','paid') NOT NULL DEFAULT 'free',
        order_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_course (user_id, course_id),
        INDEX idx_user (user_id),
        INDEX idx_course (course_id),
        INDEX idx_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ user_courses 表就绪");

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'CNY',
        status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
        payment_method VARCHAR(32) NULL,
        payment_id VARCHAR(255) NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ orders 表就绪");

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS video_progress (
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        watched_seconds INT NOT NULL DEFAULT 0,
        completed TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, video_id),
        INDEX idx_user (user_id),
        INDEX idx_video (video_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ video_progress 表就绪");

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS course_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_course (user_id, course_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ course_completions 表就绪");
  } catch (err) {
    console.error("初始化 member 表失败:", err.message);
  }
}
initMemberTables();

// 获取当前用户已加入的课程 ID 列表（供 video 等使用）
async function getEnrolledCourseIds(userId) {
  const [rows] = await pool.execute(
    "SELECT course_id FROM user_courses WHERE user_id = ?",
    [userId]
  );
  return (rows || []).map((r) => r.course_id);
}

// 我的课程列表（含每门课的学习进度）
router.get("/member/courses", authMiddleware, requireMember, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT 
         c.id,
         c.title,
         c.category,
         c.price,
         c.status,
         c.cover_url AS coverUrl,
         c.description,
         uc.source,
         uc.created_at AS enrolledAt,
         (SELECT COUNT(*) FROM videos v WHERE v.course IS NOT NULL AND v.course <> '' AND v.course = c.title AND v.status = 'published') AS videoCount,
         (SELECT COUNT(*) FROM video_progress vp
          JOIN videos v ON v.id = vp.video_id AND v.course = c.title AND v.status = 'published'
          WHERE vp.user_id = ? AND vp.completed = 1) AS completedCount,
         (SELECT IFNULL(SUM(vp2.watched_seconds), 0) FROM video_progress vp2
          JOIN videos v2 ON v2.id = vp2.video_id AND v2.course = c.title AND v2.status = 'published'
          WHERE vp2.user_id = ?) AS watchedSeconds
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE uc.user_id = ?
       ORDER BY uc.created_at DESC`,
      [userId, userId, userId]
    );
    const items = (rows || []).map((r) => {
      const videoCount = Number(r.videoCount) || 0;
      const completedCount = Number(r.completedCount) || 0;
      const progressPercent = videoCount > 0 ? Math.min(100, Math.round((completedCount / videoCount) * 100)) : 0;
      return {
        ...r,
        videoCount,
        completedCount,
        progressPercent,
        watchedSeconds: Number(r.watchedSeconds) || 0,
        completed: videoCount > 0 && completedCount >= videoCount,
      };
    });
    res.json({ items });
  } catch (err) {
    console.error("获取我的课程失败:", err);
    res.status(500).json({ message: "获取我的课程失败" });
  }
});

// 免费课程：加入
router.post("/member/courses/:courseId/enroll", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const courseId = parseInt(req.params.courseId, 10);
  if (!courseId) {
    return res.status(400).json({ message: "课程 ID 无效" });
  }

  try {
    const [courseRows] = await pool.execute(
      "SELECT id, title, price, status FROM courses WHERE id = ? AND status IN ('published','free')",
      [courseId]
    );
    if (!courseRows.length) {
      return res.status(404).json({ message: "课程不存在或已下架" });
    }
    const course = courseRows[0];
    const price = Number(course.price) || 0;
    const isFree = course.status === "free" || price <= 0;

    if (!isFree) {
      return res.status(400).json({ message: "该课程为收费课程，请点击购买" });
    }

    await pool.execute(
      "INSERT IGNORE INTO user_courses (user_id, course_id, source) VALUES (?, ?, 'free')",
      [userId, courseId]
    );
    const [check] = await pool.execute(
      "SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    if (check.length === 0) {
      return res.status(409).json({ message: "您已加入过该课程" });
    }
    res.json({ message: "加入成功", courseId });
  } catch (err) {
    console.error("加入课程失败:", err);
    res.status(500).json({ message: "加入课程失败" });
  }
});

// 检查用户是否已拥有某课程
router.get("/member/courses/:courseId/owned", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const courseId = parseInt(req.params.courseId, 10);
  if (!courseId) {
    return res.json({ owned: false });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    res.json({ owned: rows.length > 0 });
  } catch (err) {
    res.json({ owned: false });
  }
});

// 获取指定课程下的可观看视频（仅限已加入/已购买该课程的用户，含学习进度）
router.get("/member/courses/:courseId/videos", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const courseId = parseInt(req.params.courseId, 10);
  if (!courseId) {
    return res.status(400).json({ message: "课程 ID 无效" });
  }
  try {
    const [enrolled] = await pool.execute(
      "SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    if (!enrolled.length) {
      return res.status(403).json({ message: "您尚未加入该课程，无法观看视频" });
    }
    const [courseRows] = await pool.execute(
      "SELECT id, title, cover_url AS coverUrl FROM courses WHERE id = ?",
      [courseId]
    );
    if (!courseRows.length) {
      return res.status(404).json({ message: "课程不存在" });
    }
    const courseTitle = courseRows[0].title;
    const coverUrl = courseRows[0].coverUrl || null;
    const [videoRows] = await pool.execute(
      `SELECT 
         v.id,
         v.title,
         v.course,
         v.price,
         v.duration_minutes AS durationMinutes,
         v.description,
         v.status,
         v.play_url AS playUrl,
         v.created_at AS createdAt,
         vp.watched_seconds AS watchedSeconds,
         vp.completed AS progressCompleted
       FROM videos v
       LEFT JOIN video_progress vp ON vp.video_id = v.id AND vp.user_id = ?
       WHERE v.course = ? AND v.status = 'published'
       ORDER BY v.created_at ASC`,
      [userId, courseTitle]
    );
    const items = (videoRows || []).map((v) => ({
      id: v.id,
      title: v.title,
      course: v.course,
      price: v.price,
      durationMinutes: v.durationMinutes,
      description: v.description,
      status: v.status,
      playUrl: v.playUrl,
      createdAt: v.createdAt,
      progress: {
        watchedSeconds: Number(v.watchedSeconds) || 0,
        completed: !!v.progressCompleted,
      },
    }));
    res.json({
      course: {
        id: courseId,
        title: courseTitle,
        coverUrl,
      },
      items,
    });
  } catch (err) {
    console.error("获取课程视频失败:", err);
    res.status(500).json({ message: "获取课程视频失败" });
  }
});

// 上报/保存视频观看进度（根据真实观看情况更新学习进度与成就）
const PROGRESS_COMPLETE_THRESHOLD = 0.95;
router.put("/member/progress", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const { courseId, videoId, currentTime, duration } = req.body;
  const cid = parseInt(courseId, 10);
  const vid = parseInt(videoId, 10);
  if (!cid || !vid) {
    return res.status(400).json({ message: "课程 ID 或视频 ID 无效" });
  }
  const seconds = Math.max(0, Math.floor(Number(currentTime) || 0));
  const totalSeconds = Math.max(0, Math.floor(Number(duration) || 0));
  const completed = totalSeconds > 0 && seconds >= totalSeconds * PROGRESS_COMPLETE_THRESHOLD;

  try {
    const [enrolled] = await pool.execute(
      "SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?",
      [userId, cid]
    );
    if (!enrolled.length) {
      return res.status(403).json({ message: "您尚未加入该课程" });
    }
    const [videoRow] = await pool.execute(
      "SELECT id FROM videos WHERE id = ? AND status = 'published'",
      [vid]
    );
    if (!videoRow.length) {
      return res.status(404).json({ message: "视频不存在" });
    }

    await pool.execute(
      `INSERT INTO video_progress (user_id, video_id, watched_seconds, completed, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         watched_seconds = VALUES(watched_seconds),
         completed = VALUES(completed),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, vid, seconds, completed ? 1 : 0]
    );

    if (completed) {
      const [courseRow] = await pool.execute(
        "SELECT title FROM courses WHERE id = ?",
        [cid]
      );
      if (courseRow.length) {
        const courseTitle = courseRow[0].title;
        const [totalVideos] = await pool.execute(
          "SELECT COUNT(*) AS cnt FROM videos WHERE course = ? AND status = 'published'",
          [courseTitle]
        );
        const [completedVideos] = await pool.execute(
          `SELECT COUNT(*) AS cnt FROM video_progress vp
           JOIN videos v ON v.id = vp.video_id AND v.course = ?
           WHERE vp.user_id = ? AND vp.completed = 1`,
          [courseTitle, userId]
        );
        const total = (totalVideos[0] && totalVideos[0].cnt) || 0;
        const done = (completedVideos[0] && completedVideos[0].cnt) || 0;
        if (total > 0 && done >= total) {
          await pool.execute(
            `INSERT IGNORE INTO course_completions (user_id, course_id) VALUES (?, ?)`,
            [userId, cid]
          );
        }
      }
    }

    res.json({ ok: true, completed });
  } catch (err) {
    console.error("保存学习进度失败:", err);
    res.status(500).json({ message: "保存学习进度失败" });
  }
});

// 学习统计与成就（用于会员中心学习进度、学习统计、学习成就）
router.get("/member/stats", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  try {
    const [coursesRows] = await pool.execute(
      `SELECT c.id, c.title,
         (SELECT COUNT(*) FROM videos v WHERE v.course = c.title AND v.status = 'published') AS videoCount,
         (SELECT COUNT(*) FROM video_progress vp JOIN videos v ON v.id = vp.video_id AND v.course = c.title AND v.status = 'published' WHERE vp.user_id = ? AND vp.completed = 1) AS completedCount
       FROM user_courses uc
       JOIN courses c ON c.id = uc.course_id
       WHERE uc.user_id = ?`,
      [userId, userId]
    );
    let totalVideos = 0;
    let completedVideos = 0;
    (coursesRows || []).forEach((r) => {
      totalVideos += Number(r.videoCount) || 0;
      completedVideos += Number(r.completedCount) || 0;
    });
    const overallProgressPercent = totalVideos > 0 ? Math.min(100, Math.round((completedVideos / totalVideos) * 100)) : 0;

    const [completions] = await pool.execute(
      `SELECT cc.course_id AS courseId, c.title
       FROM course_completions cc
       JOIN courses c ON c.id = cc.course_id
       WHERE cc.user_id = ?
       ORDER BY cc.completed_at DESC`,
      [userId]
    );
    const coursesCompleted = (completions || []).length;
    const achievements = (completions || []).map((r) => ({
      type: "course_completed",
      courseId: r.courseId,
      title: r.title,
      label: `完成课程：${r.title}`,
    }));

    const [watchThisWeek] = await pool.execute(
      `SELECT IFNULL(SUM(watched_seconds), 0) AS total
       FROM video_progress vp
       WHERE vp.user_id = ? AND vp.updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [userId]
    );
    const watchSecondsThisWeek = Number((watchThisWeek[0] && watchThisWeek[0].total) || 0);
    const watchHoursThisWeek = Math.round((watchSecondsThisWeek / 3600) * 10) / 10;

    const [consecutiveRows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(updated_at)) AS days
       FROM video_progress
       WHERE user_id = ? AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [userId]
    );
    const consecutiveDays = Number((consecutiveRows[0] && consecutiveRows[0].days) || 0);

    res.json({
      overallProgressPercent,
      totalVideos,
      completedVideos,
      coursesCompleted,
      watchHoursThisWeek,
      consecutiveDays,
      courseCompletionRate: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
      achievements,
    });
  } catch (err) {
    console.error("获取学习统计失败:", err);
    res.status(500).json({ message: "获取学习统计失败" });
  }
});

// 创建订单（收费课程）
router.post("/member/orders", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.body;
  const cid = parseInt(courseId, 10);
  if (!cid) {
    return res.status(400).json({ message: "请选择课程" });
  }

  try {
    const [courseRows] = await pool.execute(
      "SELECT id, title, price, status FROM courses WHERE id = ? AND status IN ('published','free')",
      [cid]
    );
    if (!courseRows.length) {
      return res.status(404).json({ message: "课程不存在或已下架" });
    }
    const course = courseRows[0];
    const amount = Number(course.price) || 0;
    if (amount <= 0) {
      return res.status(400).json({ message: "该课程为免费课程，请直接点击加入" });
    }

    const [existing] = await pool.execute(
      "SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?",
      [userId, cid]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "您已拥有该课程，无需重复购买" });
    }

    const [result] = await pool.execute(
      "INSERT INTO orders (user_id, course_id, amount, currency, status) VALUES (?, ?, ?, 'CNY', 'pending')",
      [userId, cid, amount]
    );
    const orderId = result.insertId;
    res.status(201).json({
      orderId,
      courseId: cid,
      title: course.title,
      amount,
      currency: "CNY",
      status: "pending",
    });
  } catch (err) {
    console.error("创建订单失败:", err);
    res.status(500).json({ message: "创建订单失败" });
  }
});

// 查询订单状态
router.get("/member/orders/:orderId", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const orderId = parseInt(req.params.orderId, 10);
  if (!orderId) {
    return res.status(400).json({ message: "订单 ID 无效" });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id AS orderId, user_id, course_id AS courseId, amount, currency, status, payment_method AS paymentMethod, paid_at AS paidAt, created_at AS createdAt FROM orders WHERE id = ? AND user_id = ?",
      [orderId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "订单不存在" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("查询订单失败:", err);
    res.status(500).json({ message: "查询订单失败" });
  }
});

// 模拟支付确认（开发/演示用；正式环境可替换为微信/支付宝回调）
router.post("/member/orders/:orderId/confirm-mock", authMiddleware, requireMember, async (req, res) => {
  const userId = req.user.id;
  const orderId = parseInt(req.params.orderId, 10);
  if (!orderId) {
    return res.status(400).json({ message: "订单 ID 无效" });
  }

  try {
    const [orders] = await pool.execute(
      "SELECT id, user_id, course_id, amount, status FROM orders WHERE id = ? AND user_id = ?",
      [orderId, userId]
    );
    if (!orders.length) {
      return res.status(404).json({ message: "订单不存在" });
    }
    const order = orders[0];
    if (order.status === "paid") {
      return res.json({ message: "订单已支付", status: "paid" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ message: "订单状态不允许支付" });
    }

    await pool.execute(
      "UPDATE orders SET status = 'paid', payment_method = 'mock', paid_at = CURRENT_TIMESTAMP WHERE id = ?",
      [orderId]
    );
    await pool.execute(
      "INSERT IGNORE INTO user_courses (user_id, course_id, source, order_id) VALUES (?, ?, 'paid', ?)",
      [userId, order.course_id, orderId]
    );
    res.json({ message: "支付成功", status: "paid", courseId: order.course_id });
  } catch (err) {
    console.error("模拟支付确认失败:", err);
    res.status(500).json({ message: "支付确认失败" });
  }
});

module.exports = router;
module.exports.getEnrolledCourseIds = getEnrolledCourseIds;
