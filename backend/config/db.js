const mysql = require("mysql2/promise");

// 数据库配置
const dbConfig = {
  host: "101.33.221.172",
  port: 3306,
  user: "cgq274", // ⚠️ 请根据实际情况修改用户名
  password: "cgq@274184", // ⚠️ 请根据实际情况修改密码
  database: "jingfang",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 连接超时时间（10秒）
};

// 打印实际使用的配置（不包含密码）
console.log("数据库配置:", {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
});

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库表（如果不存在则创建）
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'member') DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // 如果表已存在，检查并添加 phone 字段（用于已有数据库）
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'
      `, [dbConfig.database]);
      
      if (columns.length === 0) {
        // 先检查是否有数据，如果有数据需要先允许 NULL
        const [rows] = await connection.query("SELECT COUNT(*) as count FROM users");
        const hasData = rows[0].count > 0;
        
        if (hasData) {
          // 如果有数据，先添加允许 NULL 的字段，然后更新为 NOT NULL
          await connection.query(`
            ALTER TABLE users 
            ADD COLUMN phone VARCHAR(20) AFTER email
          `);
          // 为现有数据设置默认值（使用临时值）
          await connection.query(`
            UPDATE users SET phone = CONCAT('temp_', id) WHERE phone IS NULL
          `);
          // 添加唯一索引
          await connection.query(`
            ALTER TABLE users 
            ADD UNIQUE INDEX idx_phone_unique (phone)
          `);
          // 修改为 NOT NULL
          await connection.query(`
            ALTER TABLE users 
            MODIFY COLUMN phone VARCHAR(20) NOT NULL
          `);
        } else {
          // 没有数据，直接添加 NOT NULL 字段
          await connection.query(`
            ALTER TABLE users 
            ADD COLUMN phone VARCHAR(20) UNIQUE NOT NULL AFTER email
          `);
        }
        console.log("已添加 phone 字段到 users 表");
      }
    } catch (alterError) {
      // 忽略字段已存在的错误
      if (!alterError.message.includes('Duplicate column name') && 
          !alterError.message.includes('Duplicate key name')) {
        console.warn("添加 phone 字段时出现警告:", alterError.message);
      }
    }

    // 添加 status 字段（用户状态：active=正常, disabled=禁用）
    try {
      const [statusColumns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
      `, [dbConfig.database]);
      
      if (statusColumns.length === 0) {
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN status ENUM('active', 'disabled') DEFAULT 'active' AFTER role
        `);
        console.log("已添加 status 字段到 users 表");
      }
    } catch (alterError) {
      if (!alterError.message.includes('Duplicate column name')) {
        console.warn("添加 status 字段时出现警告:", alterError.message);
      }
    }
    connection.release();
    console.log("数据库表初始化成功");
  } catch (error) {
    console.error("数据库初始化失败:", error.message);
    console.error("错误详情:", {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
    });
    // 不抛出错误，允许应用继续运行（但注册功能可能不可用）
    console.warn("警告：数据库初始化失败，某些功能可能不可用");
  }
}

module.exports = { pool, initDatabase, dbConfig };
