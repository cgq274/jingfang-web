const { pool } = require("../config/db");

// 初始化操作日志表
async function initAuditLogTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id INT,
        resource_title VARCHAR(255),
        details TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_resource_type (resource_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ 操作日志表初始化成功");
  } catch (err) {
    console.error("初始化操作日志表失败:", err.message);
  }
}

initAuditLogTable();

function parseRetentionDays() {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const n = raw != null ? parseInt(String(raw), 10) : 90;
  if (!Number.isFinite(n) || n <= 0) return 90;
  return Math.min(3650, Math.max(1, n)); // 1 ~ 3650 天
}

async function cleanupOldAuditLogs() {
  const days = parseRetentionDays();
  try {
    // INTERVAL 不能用占位符时，用安全整数拼接
    const sql = `DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    const [result] = await pool.execute(sql);
    if (result && typeof result.affectedRows === "number" && result.affectedRows > 0) {
      console.log(`✓ 操作日志自动清理完成：删除 ${result.affectedRows} 条（保留最近 ${days} 天）`);
    }
  } catch (err) {
    console.error("操作日志自动清理失败（忽略）:", err.message);
  }
}

// 启动定时清理：启动时先清一次，然后每 24 小时清理一次
setTimeout(() => {
  cleanupOldAuditLogs();
  setInterval(cleanupOldAuditLogs, 24 * 60 * 60 * 1000);
}, 10 * 1000);

/**
 * 记录操作日志
 * @param {Object} options
 * @param {number} options.userId - 操作用户ID
 * @param {string} options.username - 操作用户名
 * @param {string} options.action - 操作类型 (create, update, delete, login, etc.)
 * @param {string} options.resourceType - 资源类型 (video, course, user, settings, etc.)
 * @param {number} [options.resourceId] - 资源ID（可选）
 * @param {string} [options.resourceTitle] - 资源标题（可选）
 * @param {string} [options.details] - 详细信息（可选）
 * @param {Object} [options.req] - Express request 对象（用于获取 IP 和 User-Agent）
 */
async function logAction({
  userId,
  username,
  action,
  resourceType,
  resourceId = null,
  resourceTitle = null,
  details = null,
  req = null,
}) {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      // 获取真实 IP（考虑代理）
      ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        null;
      userAgent = req.headers["user-agent"] || null;
    }

    await pool.execute(
      `INSERT INTO audit_logs 
       (user_id, username, action, resource_type, resource_id, resource_title, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId != null ? Number(userId) : 0,
        username != null ? String(username) : "unknown",
        action,
        resourceType,
        resourceId,
        resourceTitle,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    // 日志记录失败不应该影响主业务，只打印错误
    console.error("记录操作日志失败:", err.message);
  }
}

module.exports = { logAction, initAuditLogTable, cleanupOldAuditLogs };
