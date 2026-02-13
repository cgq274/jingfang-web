const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "edu_platform_secret";

/**
 * 验证 JWT，将解码后的用户信息写入 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "未提供 token" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "token 无效或已过期" });
  }
}

module.exports = { authMiddleware };
