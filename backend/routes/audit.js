const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function safeJsonParse(maybeJson) {
  if (!maybeJson) return null;
  try {
    return JSON.parse(maybeJson);
  } catch (e) {
    return { _raw: String(maybeJson) };
  }
}

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  // CSV 需要对包含逗号/引号/换行的字段加引号，并把引号翻倍
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// 获取操作日志列表（仅管理员）
router.get("/audit-logs", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问操作日志" });
  }

  try {
    const { page = 1, limit = 50, action, resourceType, username } = req.query;

    // MySQL 某些版本/配置下，LIMIT/OFFSET 不能作为预编译参数传递
    // 这里将其转成安全的整数后直接拼接到 SQL（其余条件仍使用参数化）
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitIntRaw = parseInt(limit, 10) || 50;
    const limitInt = Math.min(200, Math.max(1, limitIntRaw)); // 1~200
    const offsetInt = (pageInt - 1) * limitInt;

    let query = "SELECT * FROM audit_logs WHERE 1=1";
    const params = [];

    // 筛选条件
    if (action) {
      query += " AND action = ?";
      params.push(action);
    }
    if (resourceType) {
      query += " AND resource_type = ?";
      params.push(resourceType);
    }
    if (username) {
      query += " AND username LIKE ?";
      params.push(`%${username}%`);
    }

    // 排序和分页
    query += ` ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const [rows] = await pool.execute(query, params);

    // 获取总数
    let countQuery = "SELECT COUNT(*) AS total FROM audit_logs WHERE 1=1";
    const countParams = [];
    if (action) {
      countQuery += " AND action = ?";
      countParams.push(action);
    }
    if (resourceType) {
      countQuery += " AND resource_type = ?";
      countParams.push(resourceType);
    }
    if (username) {
      countQuery += " AND username LIKE ?";
      countParams.push(`%${username}%`);
    }
    const [[countRow]] = await pool.execute(countQuery, countParams);
    const total = countRow.total || 0;

    // 解析 details JSON
    const logs = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceTitle: row.resource_title,
      details: safeJsonParse(row.details),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));

    res.json({
      items: logs,
      total,
      page: pageInt,
      limit: limitInt,
      totalPages: Math.ceil(total / limitInt),
    });
  } catch (err) {
    console.error("获取操作日志失败:", err);
    res.status(500).json({ message: "获取操作日志失败" });
  }
});

// 导出操作日志 CSV（仅管理员）
router.get("/audit-logs/export", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限导出操作日志" });
  }

  try {
    const { action, resourceType, username } = req.query;

    let query = "SELECT * FROM audit_logs WHERE 1=1";
    const params = [];

    if (action) {
      query += " AND action = ?";
      params.push(action);
    }
    if (resourceType) {
      query += " AND resource_type = ?";
      params.push(resourceType);
    }
    if (username) {
      query += " AND username LIKE ?";
      params.push(`%${username}%`);
    }

    // 导出限制：最多 50000 条，避免把服务拖死
    query += " ORDER BY created_at DESC LIMIT 50000";

    const [rows] = await pool.execute(query, params);

    const header = [
      "id",
      "created_at",
      "username",
      "user_id",
      "action",
      "resource_type",
      "resource_id",
      "resource_title",
      "ip_address",
      "user_agent",
      "details",
    ];

    const lines = [header.join(",")];
    for (const row of rows) {
      const line = [
        row.id,
        row.created_at,
        row.username,
        row.user_id,
        row.action,
        row.resource_type,
        row.resource_id,
        row.resource_title,
        row.ip_address,
        row.user_agent,
        row.details,
      ].map(escapeCsvCell);
      lines.push(line.join(","));
    }

    const csv = lines.join("\r\n");
    const filename = `audit_logs_${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // 加 BOM，Excel 友好
  } catch (err) {
    console.error("导出操作日志失败:", err);
    res.status(500).json({ message: "导出操作日志失败" });
  }
});

// 获取操作统计（仅管理员）
router.get("/audit-logs/stats", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问操作统计" });
  }

  try {
    // 最近7天的操作统计
    const [actionStats] = await pool.execute(
      `SELECT action, COUNT(*) AS count 
       FROM audit_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY action 
       ORDER BY count DESC`
    );

    // 按资源类型统计
    const [resourceStats] = await pool.execute(
      `SELECT resource_type, COUNT(*) AS count 
       FROM audit_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY resource_type 
       ORDER BY count DESC`
    );

    // 最近活跃用户（最近7天）
    const [activeUsers] = await pool.execute(
      `SELECT username, COUNT(*) AS count 
       FROM audit_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY username 
       ORDER BY count DESC 
       LIMIT 10`
    );

    res.json({
      actionStats,
      resourceStats,
      activeUsers,
    });
  } catch (err) {
    console.error("获取操作统计失败:", err);
    res.status(500).json({ message: "获取操作统计失败" });
  }
});

module.exports = router;
