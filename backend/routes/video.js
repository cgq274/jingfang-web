const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const multer = require("multer");
const { cosClient, cosConfig, getPresignedUploadUrl, getPublicUrl } = require("../config/cos");

const router = express.Router();

// 初始化视频表（若不存在）
async function initVideoTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        course VARCHAR(255),
        price DECIMAL(10,2) DEFAULT 0,
        duration_minutes INT DEFAULT 0,
        description TEXT,
        status ENUM('draft','published','review') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_title (title)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ 视频表初始化成功");

    // 确保新字段存在（兼容已存在的老表结构）
    try {
      await pool.execute(
        "ALTER TABLE videos ADD COLUMN object_key VARCHAR(512) NULL, ADD COLUMN play_url VARCHAR(1024) NULL"
      );
      console.log("✓ 视频表列扩展成功（object_key, play_url）");
    } catch (alterErr) {
      // 若列已存在，则忽略该错误
      if (alterErr && alterErr.code === "ER_DUP_FIELDNAME") {
        console.log("ℹ 视频表列已存在（object_key / play_url），跳过扩展");
      } else {
        console.warn("⚠ 视频表列扩展失败（可忽略，如为重复字段）:", alterErr.message);
      }
    }
  } catch (err) {
    console.error("初始化视频表失败:", err.message);
  }
}

initVideoTable();

// 使用内存存储接收上传文件（适合中小文件；大文件可后续改为流式）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});

// 生成 COS 预签名上传 URL（仅管理员）
router.post("/videos/upload-url", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限申请上传地址" });
  }

  const { filename, filesize, courseId } = req.body || {};

  if (!filename) {
    return res.status(400).json({ message: "缺少文件名 filename" });
  }

  try {
    const safeName = String(filename).replace(/[^\w.\-]+/g, "_");
    const now = new Date();
    const ts = now.getTime();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");

    const coursePart = courseId ? `course-${courseId}` : "uncategorized";
    const objectKey = `videos/${coursePart}/${dateStr}/${ts}-${safeName}`;

    const { uploadUrl, playUrl } = await getPresignedUploadUrl({
      objectKey,
      expires: 600, // 10 分钟有效
    });

    res.json({
      uploadUrl,
      objectKey,
      playUrl,
      expiresIn: 600,
      filesize,
    });
  } catch (err) {
    console.error("生成 COS 预签名上传 URL 失败:", err);
    res.status(500).json({ message: "生成上传地址失败，请稍后重试" });
  }
});

// 上传真实视频文件并创建视频记录（仅管理员）
router.post("/videos/upload-file", authMiddleware, upload.single("file"), async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限上传视频" });
  }

  const file = req.file;
  const { title, course, price, durationMinutes, description, status } = req.body || {};

  if (!file) {
    return res.status(400).json({ message: "缺少视频文件（file）" });
  }

  if (!title) {
    return res.status(400).json({ message: "视频标题不能为空" });
  }

  try {
    const safeName = String(file.originalname || "video.mp4").replace(/[^\w.\-]+/g, "_");
    const now = new Date();
    const ts = now.getTime();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");

    const objectKey = `videos/uncategorized/${dateStr}/${ts}-${safeName}`;

    await new Promise((resolve, reject) => {
      cosClient.putObject(
        {
          Bucket: cosConfig.Bucket,
          Region: cosConfig.Region,
          Key: objectKey,
          Body: file.buffer,
          ContentLength: file.size,
          ContentType: file.mimetype || "application/octet-stream",
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    const playUrl = getPublicUrl(objectKey);

    const [result] = await pool.execute(
      "INSERT INTO videos (title, course, price, duration_minutes, description, status, object_key, play_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        course || null,
        price != null ? Number(price) : 0,
        durationMinutes != null ? Number(durationMinutes) : 0,
        description || null,
        status || "published",
        objectKey,
        playUrl,
      ]
    );

    const videoId = result.insertId;

    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "create",
      resourceType: "video",
      resourceId: videoId,
      resourceTitle: title,
      details: { course, price, durationMinutes, status, objectKey, playUrl },
      req,
    });

    res.status(201).json({
      id: videoId,
      title,
      course: course || null,
      price: price != null ? Number(price) : 0,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : 0,
      description: description || null,
      status: status || "published",
      playUrl,
    });
  } catch (err) {
    console.error("上传并创建视频失败:", err);
    res.status(500).json({ message: "上传或保存视频失败" });
  }
});

// 获取视频列表（仅管理员）
router.get("/videos", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问视频列表" });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT id, title, course, price, duration_minutes AS durationMinutes, description, status, created_at AS createdAt FROM videos ORDER BY created_at DESC"
    );
    res.json({ items: rows });
  } catch (err) {
    console.error("获取视频列表失败:", err);
    res.status(500).json({ message: "获取视频列表失败" });
  }
});

// 学员端：获取当前用户可观看的视频列表（仅限已加入/已购买课程下的视频）
router.get("/member/videos", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [enrolled] = await pool.execute(
      "SELECT c.title FROM user_courses uc JOIN courses c ON c.id = uc.course_id WHERE uc.user_id = ?",
      [userId]
    );
    const courseTitles = (enrolled || []).map((r) => r.title).filter(Boolean);
    if (courseTitles.length === 0) {
      return res.json({ items: [] });
    }
    const placeholders = courseTitles.map(() => "?").join(",");
    const [rows] = await pool.execute(
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
       WHERE status = 'published' AND play_url IS NOT NULL AND course IN (${placeholders})
       ORDER BY course ASC, created_at ASC`,
      courseTitles
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("获取学员可观看视频列表失败:", err);
    res.status(500).json({ message: "获取可观看视频列表失败" });
  }
});

// 创建新视频（仅管理员）
router.post("/videos", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限创建视频" });
  }

  const {
    title,
    course,
    price,
    durationMinutes,
    description,
    status,
    objectKey,
    playUrl,
  } = req.body;

  if (!title) {
    return res.status(400).json({ message: "视频标题不能为空" });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO videos (title, course, price, duration_minutes, description, status, object_key, play_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        course || null,
        price != null ? Number(price) : 0,
        durationMinutes != null ? Number(durationMinutes) : 0,
        description || null,
        status || "published",
        objectKey || null,
        playUrl || null,
      ]
    );

    const videoId = result.insertId;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "create",
      resourceType: "video",
      resourceId: videoId,
      resourceTitle: title,
      details: { course, price, durationMinutes, status, objectKey, playUrl },
      req,
    });

    res.status(201).json({
      id: videoId,
      title,
      course: course || null,
      price: price != null ? Number(price) : 0,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : 0,
      description: description || null,
      status: status || "published",
    });
  } catch (err) {
    console.error("创建视频失败:", err);
    res.status(500).json({ message: "创建视频失败" });
  }
});

// 更新视频（仅管理员）
router.put("/videos/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限更新视频" });
  }

  const { id } = req.params;
  const { title, course, price, durationMinutes, description, status } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE videos 
       SET title = ?, course = ?, price = ?, duration_minutes = ?, description = ?, status = ?
       WHERE id = ?`,
      [
        title,
        course || null,
        price != null ? Number(price) : 0,
        durationMinutes != null ? Number(durationMinutes) : 0,
        description || null,
        status || "published",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "视频不存在" });
    }

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "video",
      resourceId: Number(id),
      resourceTitle: title,
      details: { course, price, durationMinutes, status },
      req,
    });

    res.json({ message: "更新成功" });
  } catch (err) {
    console.error("更新视频失败:", err);
    res.status(500).json({ message: "更新视频失败" });
  }
});

// 删除视频（仅管理员）
router.delete("/videos/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限删除视频" });
  }

  const { id } = req.params;

  try {
    // 先获取视频信息用于日志
    const [videoRows] = await pool.execute("SELECT title FROM videos WHERE id = ?", [id]);
    const videoTitle = videoRows.length > 0 ? videoRows[0].title : null;

    const [result] = await pool.execute("DELETE FROM videos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "视频不存在" });
    }

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "delete",
      resourceType: "video",
      resourceId: Number(id),
      resourceTitle: videoTitle,
      req,
    });

    res.json({ message: "删除成功" });
  } catch (err) {
    console.error("删除视频失败:", err);
    res.status(500).json({ message: "删除视频失败" });
  }
});

module.exports = router;

