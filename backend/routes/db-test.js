const express = require("express");
const { pool, dbConfig } = require("../config/db");

const router = express.Router();

// 测试数据库连接
router.get("/test-db", async (req, res) => {
  // 获取实际配置（不包含密码）
  const config = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
  };

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ 
      success: true, 
      message: "数据库连接成功",
      config: config
    });
  } catch (error) {
    // 根据错误类型提供更详细的建议
    let suggestion = "请检查：";
    if (error.code === "ER_ACCESS_DENIED_ERROR" || error.code === "ER_DBACCESS_DENIED_ERROR") {
      if (error.code === "ER_DBACCESS_DENIED_ERROR") {
        suggestion += `1) 用户 '${config.user}' 是否有访问数据库 '${config.database}' 的权限 2) 需要在数据库服务器上执行 GRANT 命令授权`;
      } else {
        suggestion += "1) 用户名或密码是否正确 2) 用户是否有从你的IP连接的权限（需要在数据库服务器上执行 GRANT 命令）";
      }
    } else if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
      suggestion += "1) 数据库服务是否运行 2) 网络是否可达 3) 防火墙是否允许连接";
    } else {
      suggestion += "1) 数据库服务是否运行 2) 网络是否可达 3) 防火墙是否允许连接 4) 数据库用户是否有远程连接权限";
    }

    res.status(500).json({
      success: false,
      message: "数据库连接失败",
      error: error.message,
      code: error.code,
      errno: error.errno,
      config: config,
      details: {
        suggestion: suggestion,
        yourIP: req.ip || req.connection.remoteAddress || "未知",
        note: `如果看到 'Access denied'，需要在数据库服务器上执行：GRANT ALL PRIVILEGES ON ${config.database}.* TO '${config.user}'@'%' IDENTIFIED BY '你的密码'; FLUSH PRIVILEGES;`
      }
    });
  }
});

module.exports = router;
