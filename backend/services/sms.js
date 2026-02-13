// 短信验证码服务
// 在生产环境中，应使用真实的短信服务（如阿里云、腾讯云等）

// 内存存储验证码（生产环境应使用 Redis）
const verificationCodes = new Map();

// 验证码有效期（5分钟）
const CODE_EXPIRY = 5 * 60 * 1000;

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送验证码（模拟）
 * 实际项目中应调用短信服务商 API
 */
function sendVerificationCode(phone) {
  const code = generateCode();
  const expiry = Date.now() + CODE_EXPIRY;

  // 存储验证码
  verificationCodes.set(phone, {
    code,
    expiry,
    attempts: 0, // 验证尝试次数
  });

  // 模拟发送短信（实际应调用短信 API）
  console.log(`[短信验证码] 发送到 ${phone}: ${code} (有效期5分钟)`);
  
  // TODO: 实际项目中应调用短信服务，例如：
  // await smsService.send(phone, `您的验证码是：${code}，5分钟内有效`);
  
  return code; // 开发环境返回验证码，方便测试
}

/**
 * 验证验证码
 */
function verifyCode(phone, inputCode) {
  const stored = verificationCodes.get(phone);

  if (!stored) {
    return { valid: false, message: "验证码不存在或已过期" };
  }

  if (Date.now() > stored.expiry) {
    verificationCodes.delete(phone);
    return { valid: false, message: "验证码已过期，请重新获取" };
  }

  // 限制验证尝试次数（防止暴力破解）
  if (stored.attempts >= 5) {
    verificationCodes.delete(phone);
    return { valid: false, message: "验证失败次数过多，请重新获取验证码" };
  }

  stored.attempts++;

  if (stored.code !== inputCode) {
    return { valid: false, message: "验证码错误" };
  }

  // 验证成功，删除验证码（一次性使用）
  verificationCodes.delete(phone);
  return { valid: true, message: "验证成功" };
}

/**
 * 检查手机号是否已发送过验证码（防止频繁发送）
 */
function canSendCode(phone) {
  const stored = verificationCodes.get(phone);
  if (!stored) return true;
  
  // 如果验证码还在有效期内，60秒内不能重复发送
  const timeSinceLastSend = Date.now() - (stored.expiry - CODE_EXPIRY);
  return timeSinceLastSend > 60 * 1000;
}

/**
 * 清理过期验证码（定期清理）
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [phone, data] of verificationCodes.entries()) {
    if (now > data.expiry) {
      verificationCodes.delete(phone);
    }
  }
}

// 每5分钟清理一次过期验证码
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

module.exports = {
  sendVerificationCode,
  verifyCode,
  canSendCode,
};
