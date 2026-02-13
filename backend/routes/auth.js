const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { sendVerificationCode, verifyCode, canSendCode } = require("../services/sms");

const { authMiddleware } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

// ⚠️ 实际项目应放到环境变量
const JWT_SECRET = "edu_platform_secret";

// 测试路由是否正常工作
router.get("/test", (req, res) => {
  res.json({ message: "auth routes 正常工作" });
});

// 登录接口
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "请输入用户名和密码" });
    }

    // 从数据库查询用户
    const [rows] = await pool.execute(
      "SELECT id, username, email, password, role FROM users WHERE username = ? OR email = ?",
      [username, username]
    );

    if (rows.length === 0) {
      // 记录登录失败（找不到用户）
      await logAction({
        userId: 0,
        username: String(username),
        action: "login_failed",
        resourceType: "auth",
        details: { reason: "user_not_found" },
        req,
      });
      return res.status(401).json({
        message: "您还没有注册",
        needRegister: true,
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // 记录登录失败（密码错误）
      await logAction({
        userId: user.id,
        username: user.username,
        action: "login_failed",
        resourceType: "auth",
        details: { reason: "wrong_password" },
        req,
      });
      return res.status(401).json({ message: "密码错误" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 记录登录日志（仅管理员登录时记录）
    if (user.role === "admin") {
      await logAction({
        userId: user.id,
        username: user.username,
        action: "login",
        resourceType: "auth",
        req,
      });
    }

    res.json({
      message: "登录成功",
      token,
      role: user.role,
      username: user.username,
    });
  } catch (error) {
    console.error("登录错误:", error);
    res.status(500).json({ message: "服务器错误，请稍后重试" });
  }
});

// 发送短信验证码接口
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    console.log("收到发送验证码请求，手机号:", phone);

    if (!phone) {
      return res.status(400).json({ message: "请输入手机号" });
    }

    // 验证手机号格式（11位数字，1开头）
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: "手机号格式不正确，请输入11位手机号" });
    }

    // 检查手机号是否已被注册（如果数据库可用）
    let phoneExists = false;
    try {
      const [existingUsers] = await pool.execute(
        "SELECT id FROM users WHERE phone = ?",
        [phone]
      );

      if (existingUsers.length > 0) {
        phoneExists = true;
      }
    } catch (dbError) {
      console.warn("查询用户时出错（继续执行）:", dbError.message);
      // 数据库错误不影响发送验证码（开发环境允许）
      // 生产环境应该确保数据库正常
    }

    if (phoneExists) {
      return res.status(409).json({ message: "该手机号已被注册" });
    }

    // 检查是否可以发送（防止频繁发送）
    if (!canSendCode(phone)) {
      return res.status(429).json({ message: "请稍后再试，60秒内不能重复发送" });
    }

    // 发送验证码
    const code = sendVerificationCode(phone);
    console.log(`验证码已生成并存储，手机号: ${phone}`);

    res.json({
      message: "验证码已发送",
      code: code, // 开发环境返回验证码，方便测试
    });
  } catch (error) {
    console.error("发送验证码错误:", error);
    console.error("错误详情:", {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      message: error.message,
      stack: error.stack,
    });
    
    // 数据库连接错误
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return res.status(500).json({ 
        message: "数据库连接失败，请检查数据库配置",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      message: "发送验证码失败，请稍后重试",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// 注册接口
router.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password, verificationCode, role = "member" } = req.body;
    console.log("收到注册请求:", { username, phone, email, hasPassword: !!password, verificationCode });

    // 验证必填字段
    if (!username || !password || !phone) {
      return res.status(400).json({ message: "用户名、手机号和密码不能为空" });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: "手机号格式不正确" });
    }

    // 验证验证码
    if (!verificationCode) {
      return res.status(400).json({ message: "请输入验证码" });
    }

    console.log(`验证验证码，手机号: ${phone}, 验证码: ${verificationCode}`);
    const codeVerification = verifyCode(phone, verificationCode);
    console.log("验证码验证结果:", codeVerification);
    if (!codeVerification.valid) {
      return res.status(400).json({ message: codeVerification.message });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ message: "密码长度至少6位" });
    }

    // 检查用户名或手机号是否已存在
    console.log("检查用户是否已存在...");
    let existingUsers = [];
    try {
      [existingUsers] = await pool.execute(
        "SELECT id FROM users WHERE username = ? OR phone = ? OR email = ?",
        [username, phone, email || ""]
      );
    } catch (dbError) {
      console.error("查询用户时出错:", dbError.message);
      if (dbError.code === "ETIMEDOUT" || dbError.code === "ECONNREFUSED") {
        return res.status(500).json({ 
          message: "数据库连接失败，请检查数据库服务器是否可访问",
          error: "无法连接到数据库服务器 101.33.221.172:3306，请确认：1) 数据库服务是否运行 2) 网络是否可达 3) 防火墙是否允许连接"
        });
      }
      throw dbError;
    }

    if (existingUsers.length > 0) {
      console.log("用户已存在:", existingUsers);
      return res.status(409).json({ message: "用户名、手机号或邮箱已被注册" });
    }

    // 加密密码
    console.log("加密密码...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入新用户
    console.log("插入新用户到数据库...");
    let result;
    try {
      [result] = await pool.execute(
        "INSERT INTO users (username, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
        [username, email || null, phone, hashedPassword, role]
      );
      console.log("用户插入成功，ID:", result.insertId);
    } catch (dbError) {
      console.error("插入用户时出错:", dbError.message);
      if (dbError.code === "ETIMEDOUT" || dbError.code === "ECONNREFUSED") {
        return res.status(500).json({ 
          message: "数据库连接失败，请检查数据库服务器是否可访问",
          error: "无法连接到数据库服务器 101.33.221.172:3306，请确认：1) 数据库服务是否运行 2) 网络是否可达 3) 防火墙是否允许连接"
        });
      }
      throw dbError;
    }

    // 生成 token
    const token = jwt.sign(
      { id: result.insertId, role, username },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    console.log("注册成功，用户:", username);
    res.status(201).json({
      message: "注册成功",
      token,
      role,
      username,
    });
  } catch (error) {
    console.error("注册错误:", error);
    console.error("错误详情:", {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
    });
    
    if (error.code === "ER_DUP_ENTRY") {
      // 判断是哪个字段重复
      if (error.sqlMessage && error.sqlMessage.includes("username")) {
        return res.status(409).json({ message: "用户名已被注册" });
      }
      if (error.sqlMessage && error.sqlMessage.includes("phone")) {
        return res.status(409).json({ message: "手机号已被注册" });
      }
      if (error.sqlMessage && error.sqlMessage.includes("email")) {
        return res.status(409).json({ message: "邮箱已被注册" });
      }
      return res.status(409).json({ message: "用户名、手机号或邮箱已被注册" });
    }
    
    // 数据库连接错误
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return res.status(500).json({ 
        message: "数据库连接失败，请检查数据库服务器是否可访问",
        error: "无法连接到数据库服务器 101.33.221.172:3306。请确认：1) 数据库服务是否运行 2) 网络是否可达 3) 防火墙是否允许连接 4) 数据库用户是否有远程连接权限"
      });
    }
    
    res.status(500).json({ 
      message: "服务器错误，请稍后重试",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// 发送重置密码短信验证码
router.post("/send-reset-code", async (req, res) => {
  try {
    const { phone } = req.body;
    console.log("收到重置密码发送验证码请求，手机号:", phone);

    if (!phone) {
      return res.status(400).json({ message: "请输入手机号" });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: "手机号格式不正确，请输入11位手机号" });
    }

    // 检查手机号是否已注册（重置密码必须是已注册用户）
    let existingUsers = [];
    try {
      [existingUsers] = await pool.execute(
        "SELECT id FROM users WHERE phone = ?",
        [phone]
      );
    } catch (dbError) {
      console.error("查询用户时出错（重置密码）:", dbError.message);
      if (dbError.code === "ETIMEDOUT" || dbError.code === "ECONNREFUSED") {
        return res.status(500).json({ 
          message: "数据库连接失败，请检查数据库服务器是否可访问",
          error: "无法连接到数据库服务器，请确认数据库服务和网络连接状态"
        });
      }
      throw dbError;
    }

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: "该手机号尚未注册" });
    }

    // 检查是否可以发送（防止频繁发送）
    if (!canSendCode(phone)) {
      return res.status(429).json({ message: "请稍后再试，60秒内不能重复发送" });
    }

    // 发送验证码
    const code = sendVerificationCode(phone);
    console.log(`重置密码验证码已生成并存储，手机号: ${phone}`);

    res.json({
      message: "重置密码验证码已发送",
      code: code, // 开发环境返回验证码，方便测试
    });
  } catch (error) {
    console.error("发送重置密码验证码错误:", error);
    res.status(500).json({ 
      message: "发送验证码失败，请稍后重试",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// 重置密码接口（通过手机号 + 验证码）
router.post("/reset-password", async (req, res) => {
  try {
    const { phone, verificationCode, newPassword } = req.body;
    console.log("收到重置密码请求:", { phone, hasNewPassword: !!newPassword, verificationCode });

    // 验证必填字段
    if (!phone || !verificationCode || !newPassword) {
      return res.status(400).json({ message: "手机号、验证码和新密码不能为空" });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: "手机号格式不正确" });
    }

    // 验证密码长度
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "密码长度至少6位" });
    }

    // 验证验证码
    console.log(`验证重置密码验证码，手机号: ${phone}, 验证码: ${verificationCode}`);
    const codeVerification = verifyCode(phone, verificationCode);
    console.log("重置密码验证码验证结果:", codeVerification);
    if (!codeVerification.valid) {
      return res.status(400).json({ message: codeVerification.message });
    }

    // 检查用户是否存在，并取出旧密码
    let existingUsers = [];
    try {
      [existingUsers] = await pool.execute(
        "SELECT id, password FROM users WHERE phone = ?",
        [phone]
      );
    } catch (dbError) {
      console.error("查询用户时出错（重置密码）:", dbError.message);
      if (dbError.code === "ETIMEDOUT" || dbError.code === "ECONNREFUSED") {
        return res.status(500).json({ 
          message: "数据库连接失败，请检查数据库服务器是否可访问",
          error: "无法连接到数据库服务器，请确认数据库服务和网络连接状态"
        });
      }
      throw dbError;
    }

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: "该手机号尚未注册" });
    }

    const user = existingUsers[0];

    // 校验新密码不能与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "新密码不能与旧密码相同，请设置一个不同的密码" });
    }

    const userId = user.id;

    // 加密新密码
    console.log("加密新密码...");
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新用户密码
    try {
      await pool.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedPassword, userId]
      );
      console.log("密码重置成功，用户ID:", userId);
    } catch (dbError) {
      console.error("更新用户密码时出错:", dbError.message);
      if (dbError.code === "ETIMEDOUT" || dbError.code === "ECONNREFUSED") {
        return res.status(500).json({ 
          message: "数据库连接失败，请检查数据库服务器是否可访问",
          error: "无法连接到数据库服务器，请确认数据库服务和网络连接状态"
        });
      }
      throw dbError;
    }

    res.json({ message: "密码重置成功，请使用新密码登录" });
  } catch (error) {
    console.error("重置密码错误:", error);
    res.status(500).json({ 
      message: "服务器错误，请稍后重试",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// 获取当前用户信息（需携带 token）
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
  });
});

module.exports = router;
