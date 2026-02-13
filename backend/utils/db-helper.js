const { pool } = require("../config/db");

/**
 * 安全执行数据库查询，如果失败返回默认值
 */
async function safeQuery(query, params, defaultValue = []) {
  try {
    const [result] = await pool.execute(query, params);
    return result;
  } catch (error) {
    if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
      console.warn("数据库连接失败，使用默认值:", error.message);
      return defaultValue;
    }
    throw error;
  }
}

/**
 * 检查数据库是否可用
 */
async function isDbAvailable() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { safeQuery, isDbAvailable };
