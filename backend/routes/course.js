const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const multer = require("multer");
const { cosClient, cosConfig, getPublicUrl } = require("../config/cos");

const router = express.Router();

// 初始化课程表（若不存在）
async function initCourseTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        price DECIMAL(10,2) DEFAULT 0,
        status ENUM('published','archived','free') DEFAULT 'published',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_title (title)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ 课程表初始化成功");

    // 兼容旧表结构，补充课程封面字段
    try {
      await pool.execute(
        "ALTER TABLE courses ADD COLUMN cover_url VARCHAR(1024) NULL"
      );
      console.log("✓ 课程表列扩展成功（cover_url）");
    } catch (alterErr) {
      if (alterErr && alterErr.code === "ER_DUP_FIELDNAME") {
        console.log("ℹ 课程表列已存在（cover_url），跳过扩展");
      } else {
        console.warn(
          "⚠ 课程表列扩展失败（cover_url，可忽略重复字段错误）:",
          alterErr.message
        );
      }
    }
    // 兼容旧表：移除 draft，保留 published/archived/free，草稿统一改为已发布
    try {
      await pool.execute(
        "UPDATE courses SET status = 'published' WHERE status = 'draft'"
      );
      await pool.execute(
        "ALTER TABLE courses MODIFY COLUMN status ENUM('published','archived','free') DEFAULT 'published'"
      );
      console.log("✓ 课程表 status 已移除草稿状态");
    } catch (alterErr) {
      if (alterErr && alterErr.code === "ER_PARSE_ERROR") {
        console.log("ℹ 课程表 status 已是新枚举，跳过");
      } else {
        console.warn("⚠ 课程表 status 扩展失败（可忽略）:", alterErr.message);
      }
    }
  } catch (err) {
    console.error("初始化课程表失败:", err.message);
  }
}

initCourseTable();

// 课程封面上传：使用内存存储，文件直接写入 COS
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 单个封面 5MB 足够
  },
});

// 如果 courses 表为空，自动根据 videos 表中的 course 字段补齐基础课程
async function ensureSeedCoursesFromVideos() {
  try {
    const [courseCountRows] = await pool.execute(
      "SELECT COUNT(*) AS count FROM courses"
    );
    const hasCourses = courseCountRows[0].count > 0;
    if (hasCourses) return;

    // 取出现有视频中所有非空的课程名称
    const [videoCourses] = await pool.execute(
      "SELECT DISTINCT course FROM videos WHERE course IS NOT NULL AND course <> ''"
    );

    if (!videoCourses.length) return;

    const now = new Date();
    const status = "published";

    for (const row of videoCourses) {
      const title = row.course;
      if (!title) continue;
      await pool.execute(
        "INSERT INTO courses (title, category, price, status, description) VALUES (?, ?, ?, ?, ?)",
        [title, null, 0, status, "由已有视频自动生成的课程"]
      );
    }

    console.log("✓ 已根据 videos.course 自动创建基础课程");
  } catch (err) {
    console.error("从视频自动生成课程时出错（忽略）:", err.message);
  }
}

// 获取课程列表（仅管理员）
router.get("/courses", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问课程列表" });
  }

  try {
    await ensureSeedCoursesFromVideos();
    const [rows] = await pool.execute(
      `SELECT 
         c.id,
         c.title,
         c.category,
         c.price,
         c.status,
         c.description,
         c.cover_url AS coverUrl,
         c.created_at AS createdAt,
         (
           SELECT COUNT(*) 
           FROM videos v 
           WHERE v.course IS NOT NULL 
             AND v.course <> '' 
             AND v.course = c.title
         ) AS videoCount
       FROM courses c
       ORDER BY c.created_at DESC`
    );
    res.json({ items: rows });
  } catch (err) {
    console.error("获取课程列表失败:", err);
    res.status(500).json({ message: "获取课程列表失败" });
  }
});

// 前台公开课程列表（仅已发布课程）
router.get("/public/courses", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
         c.id,
         c.title,
         c.category,
         c.price,
         c.status,
         c.description,
         c.cover_url AS coverUrl,
         c.created_at AS createdAt,
         (
           SELECT COUNT(*)
           FROM videos v
           WHERE v.course IS NOT NULL AND v.course <> '' AND v.course = c.title
         ) AS videoCount
       FROM courses c
       WHERE c.status IN ('published', 'free')
       ORDER BY c.created_at DESC`
    );
    res.json({ items: rows });
  } catch (err) {
    console.error("获取公开课程列表失败:", err);
    res.status(500).json({ message: "获取课程列表失败" });
  }
});

// 创建课程（仅管理员）
router.post("/courses", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限创建课程" });
  }

  const { title, category, price, status, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: "课程名称不能为空" });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO courses (title, category, price, status, description) VALUES (?, ?, ?, ?, ?)",
      [
        title,
        category || null,
        price != null ? Number(price) : 0,
        status || "published",
        description || null,
      ]
    );

    const courseId = result.insertId;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "create",
      resourceType: "course",
      resourceId: courseId,
      resourceTitle: title,
      details: { category, price, status },
      req,
    });

    res.status(201).json({
      id: courseId,
      title,
      category: category || null,
      price: price != null ? Number(price) : 0,
      status: status || "published",
      description: description || null,
    });
  } catch (err) {
    console.error("创建课程失败:", err);
    res.status(500).json({ message: "创建课程失败" });
  }
});

// 更新课程（仅管理员）
router.put("/courses/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限更新课程" });
  }

  const { id } = req.params;
  const { title, category, price, status, description } = req.body;

  if (!title) {
    return res.status(400).json({ message: "课程名称不能为空" });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE courses 
       SET title = ?, category = ?, price = ?, status = ?, description = ?
       WHERE id = ?`,
      [
        title,
        category || null,
        price != null ? Number(price) : 0,
        status || "published",
        description || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "课程不存在" });
    }

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "course",
      resourceId: Number(id),
      resourceTitle: title,
      details: { category, price, status },
      req,
    });

    res.json({ message: "课程已更新" });
  } catch (err) {
    console.error("更新课程失败:", err);
    res.status(500).json({ message: "更新课程失败" });
  }
});

// 仅更新课程状态（仅管理员）
router.put("/courses/:id/status", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限更新课程状态" });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!["published", "archived", "free"].includes(status)) {
    return res.status(400).json({ message: "状态必须是 published/archived/free 之一" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE courses SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "课程不存在" });
    }

    // 获取课程标题用于日志
    const [courseRows] = await pool.execute("SELECT title FROM courses WHERE id = ?", [id]);
    const courseTitle = courseRows.length > 0 ? courseRows[0].title : null;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "course",
      resourceId: Number(id),
      resourceTitle: courseTitle,
      details: { status },
      req,
    });

    res.json({ message: "课程状态已更新" });
  } catch (err) {
    console.error("更新课程状态失败:", err);
    res.status(500).json({ message: "更新课程状态失败" });
  }
});

// 删除课程（仅管理员）
router.delete("/courses/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限删除课程" });
  }

  const { id } = req.params;

  try {
    // 先获取课程信息用于日志
    const [courseRows] = await pool.execute("SELECT title FROM courses WHERE id = ?", [id]);
    const courseTitle = courseRows.length > 0 ? courseRows[0].title : null;

    const [result] = await pool.execute("DELETE FROM courses WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "课程不存在" });
    }

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "delete",
      resourceType: "course",
      resourceId: Number(id),
      resourceTitle: courseTitle,
      req,
    });

    res.json({ message: "课程已删除" });
  } catch (err) {
    console.error("删除课程失败:", err);
    res.status(500).json({ message: "删除课程失败" });
  }
});

// 获取指定课程下的视频列表（仅管理员，用于后台查看课程内容）
router.get("/courses/:id/videos", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限查看课程下视频" });
  }

  const { id } = req.params;

  try {
    // 先获取课程标题及封面
    const [courseRows] = await pool.execute(
      "SELECT title, cover_url AS coverUrl FROM courses WHERE id = ?",
      [id]
    );

    if (!courseRows.length) {
      return res.status(404).json({ message: "课程不存在" });
    }

    const courseTitle = courseRows[0].title;
    const coverUrl = courseRows[0].coverUrl || null;

    // 根据 videos.course = 课程标题 关联查询视频
    const [videoRows] = await pool.execute(
      `SELECT 
         id,
         title,
         course,
         price,
         duration_minutes AS durationMinutes,
         description,
         status,
         play_url AS playUrl,
         created_at AS createdAt
       FROM videos
       WHERE course = ?
       ORDER BY created_at ASC`,
      [courseTitle]
    );

    res.json({
      course: {
        id: Number(id),
        title: courseTitle,
        coverUrl,
      },
      items: videoRows || [],
    });
  } catch (err) {
    console.error("获取课程下视频失败:", err);
    res.status(500).json({ message: "获取课程下视频失败" });
  }
});

// 上传或更新课程封面（仅管理员）
router.post(
  "/courses/:id/cover",
  authMiddleware,
  coverUpload.single("file"),
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "无权限上传课程封面（仅管理员）" });
    }

    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "缺少封面文件（file）" });
    }

    try {
      // 确认课程存在
      const [courseRows] = await pool.execute(
        "SELECT title FROM courses WHERE id = ?",
        [id]
      );
      if (!courseRows.length) {
        return res.status(404).json({ message: "课程不存在" });
      }

      const safeName = String(file.originalname || "cover.jpg").replace(
        /[^\w.\-]+/g,
        "_"
      );
      const now = new Date();
      const ts = now.getTime();
      const objectKey = `covers/courses/${id}/${ts}-${safeName}`;

      await new Promise((resolve, reject) => {
        cosClient.putObject(
          {
            Bucket: cosConfig.Bucket,
            Region: cosConfig.Region,
            Key: objectKey,
            Body: file.buffer,
            ContentLength: file.size,
            ContentType: file.mimetype || "image/jpeg",
          },
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      const coverUrl = getPublicUrl(objectKey);

      await pool.execute("UPDATE courses SET cover_url = ? WHERE id = ?", [
        coverUrl,
        id,
      ]);

      await logAction({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        resourceType: "course",
        resourceId: Number(id),
        resourceTitle: courseRows[0].title,
        details: { coverUrl },
        req,
      });

      res.json({ coverUrl });
    } catch (err) {
      console.error("上传课程封面失败:", err);
      res.status(500).json({ message: "上传课程封面失败" });
    }
  }
);

module.exports = router;

