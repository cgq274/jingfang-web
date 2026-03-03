const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const dbTestRoutes = require("./routes/db-test");
const videoRoutes = require("./routes/video");
const userRoutes = require("./routes/user");
const courseRoutes = require("./routes/course");
const memberRoutes = require("./routes/member");
const statsRoutes = require("./routes/stats");
const settingsRoutes = require("./routes/settings");
const auditRoutes = require("./routes/audit");
const paymentRoutes = require("./routes/payment");
const paymentService = require("./services/payment");
const { initDatabase } = require("./config/db");

const app = express();

app.use(cors());

// 支付回调必须在 express.json() 之前注册，避免 body 被错误解析或消费
// 微信：原始 JSON body 验签
app.post(
  "/api/payment/wechat/notify",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    paymentService.handleWechatNotify(req.body, req.headers, res);
  }
);
// 支付宝：form 表单 POST，必须用 urlencoded 解析
app.post(
  "/api/payment/alipay/notify",
  express.urlencoded({ extended: true, limit: "1mb" }),
  (req, res) => {
    paymentService.handleAlipayNotify(req.body, res);
  }
);

app.use(express.json());

// 初始化数据库
initDatabase().catch((err) => {
  console.error("数据库初始化失败，请检查配置:", err.message);
  console.error("请确认：");
  console.error("1. 数据库服务是否运行");
  console.error("2. 数据库连接信息是否正确（host, port, user, password）");
  console.error("3. 数据库 jingfang 是否存在");
});

// API 路由（必须在静态文件之前）
// 调试中间件：记录所有 API 请求
app.use("/api", (req, res, next) => {
  console.log(`[API 请求] ${req.method} ${req.originalUrl}`);
  next();
});

// 注册认证路由
app.use("/api", authRoutes);
console.log("✓ 认证路由已注册: /api/login, /api/register, /api/send-code, /api/me");

// 数据库测试路由
app.use("/api", dbTestRoutes);
console.log("✓ 数据库测试路由已注册: /api/test-db");

// 视频管理路由
app.use("/api", videoRoutes);
console.log("✓ 视频管理路由已注册: /api/videos");

// 用户管理路由
app.use("/api", userRoutes);
console.log("✓ 用户管理路由已注册: /api/users");

// 课程管理路由
app.use("/api", courseRoutes);
console.log("✓ 课程管理路由已注册: /api/courses");

// 学员买课/订单路由
app.use("/api", memberRoutes);
console.log("✓ 学员路由已注册: /api/member/courses, /api/member/orders");

// 支付路由（微信 Native、支付宝电脑网站及回调）
app.use("/api", paymentRoutes);
console.log("✓ 支付路由已注册: /api/payment/wechat/create, /api/payment/alipay/create, /api/payment/*/notify");

// 统计路由
app.use("/api", statsRoutes);
console.log("✓ 统计路由已注册: /api/stats/*");

// 系统设置路由
app.use("/api", settingsRoutes);
console.log("✓ 系统设置路由已注册: /api/settings, /api/public-settings");

// 操作日志路由
app.use("/api", auditRoutes);
console.log("✓ 操作日志路由已注册: /api/audit-logs");

// 测试路由
app.get("/api/ping", (req, res) => {
  res.json({ message: "backend ok" });
});

// 404 处理 - 如果 API 路由未匹配，返回错误
app.use("/api", (req, res) => {
  console.warn(`[API 404] ${req.method} ${req.originalUrl} - 路由未找到`);
  res.status(404).json({ 
    message: "API 路由未找到",
    path: req.originalUrl,
    method: req.method
  });
});

// 提供前端静态文件（前后端同一端口，避免跨域/无法连接）
// 注意：必须在所有 API 路由之后，避免拦截 API 请求
const frontendDir = path.join(__dirname, "..", "frontend");

// 静态文件中间件，但排除 /api 路径
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next(); // API 请求继续到下一个中间件
  }
  express.static(frontendDir)(req, res, next);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend + Frontend: http://localhost:${PORT}  （请用浏览器打开此地址）`);
});
