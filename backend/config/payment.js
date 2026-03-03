/**
 * 支付配置（微信支付、支付宝）
 * 敏感信息请通过环境变量配置，勿提交到版本库
 */
const path = require("path");
const fs = require("fs");

const getEnv = (key, def = "") => (process.env[key] != null ? String(process.env[key]).trim() : def);

/** backend 目录的绝对路径（不依赖 process.cwd，部署时无论工作目录如何都能正确解析） */
const backendDir = path.resolve(__dirname, "..");

/** 将相对路径解析为基于 backend 目录的绝对路径，绝对路径原样返回 */
function resolveCertPath(envPath) {
  if (!envPath || typeof envPath !== "string") return envPath;
  const trimmed = envPath.trim();
  if (!trimmed) return trimmed;
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(backendDir, trimmed);
}

/** 当前站点基础 URL，用于回调地址（如 https://yourdomain.com） */
const baseUrl = getEnv("PAYMENT_BASE_URL", "http://localhost:3000");

/** 微信支付 V3 */
const wechat = {
  enabled: getEnv("WECHAT_PAY_ENABLED", "0") === "1",
  appId: getEnv("WECHAT_APP_ID"),
  mchId: getEnv("WECHAT_MCH_ID"),
  /** APIv3 密钥（32 字节，用于回调解密） */
  apiV3Key: getEnv("WECHAT_API_V3_KEY"),
  /** 商户私钥 PEM 文件路径或内容 */
  privateKey: getEnv("WECHAT_PRIVATE_KEY") || (() => {
    const p = resolveCertPath(getEnv("WECHAT_PRIVATE_KEY_PATH") || path.join("certs", "apiclient_key.pem"));
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return "";
    }
  })(),
  /** 商户证书 PEM（公钥）文件路径或内容 */
  publicKey: getEnv("WECHAT_PUBLIC_KEY") || (() => {
    const p = resolveCertPath(getEnv("WECHAT_PUBLIC_KEY_PATH") || path.join("certs", "apiclient_cert.pem"));
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return "";
    }
  })(),
  /** 证书序列号（可选，用于回调验证） */
  serialNo: getEnv("WECHAT_SERIAL_NO"),
  notifyPath: "/api/payment/wechat/notify",
  get notifyUrl() {
    return `${baseUrl.replace(/\/$/, "")}${this.notifyPath}`;
  },
};

/** 支付宝 */
const alipay = {
  enabled: getEnv("ALIPAY_PAY_ENABLED", "0") === "1",
  appId: getEnv("ALIPAY_APP_ID"),
  /** 应用私钥 PEM 路径或字符串 */
  privateKey: getEnv("ALIPAY_PRIVATE_KEY") || (() => {
    const p = resolveCertPath(getEnv("ALIPAY_PRIVATE_KEY_PATH") || path.join("certs", "alipay_private_key.pem"));
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return "";
    }
  })(),
  /** 支付宝公钥（验签用） */
  alipayPublicKey: getEnv("ALIPAY_PUBLIC_KEY") || (() => {
    const p = resolveCertPath(getEnv("ALIPAY_PUBLIC_KEY_PATH") || path.join("certs", "alipay_public_key.pem"));
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return "";
    }
  })(),
  /** 是否使用沙箱 */
  sandbox: getEnv("ALIPAY_SANDBOX", "1") === "1",
  gateway: getEnv("ALIPAY_GATEWAY") || (getEnv("ALIPAY_SANDBOX", "1") === "1" ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do" : "https://openapi.alipay.com/gateway.do"),
  notifyPath: "/api/payment/alipay/notify",
  returnPath: "courses.html",
  get notifyUrl() {
    return `${baseUrl.replace(/\/$/, "")}${this.notifyPath}`;
  },
  get returnUrl() {
    const base = baseUrl.replace(/\/$/, "");
    const path = base ? `${base}/${this.returnPath}` : `/${this.returnPath}`;
    return `${path}${path.includes("?") ? "&" : "?"}from=alipay`;
  },
};

/** 仅用于排查：当前配置是否齐全（不返回任何敏感内容） */
function getConfigCheck() {
  return {
    envLoaded: !!(
      process.env.ALIPAY_PAY_ENABLED != null ||
      process.env.ALIPAY_APP_ID != null ||
      process.env.PAYMENT_BASE_URL != null
    ),
    alipay: {
      enabled: alipay.enabled,
      hasAppId: !!alipay.appId,
      hasPrivateKey: !!alipay.privateKey,
      hasPublicKey: !!alipay.alipayPublicKey,
    },
    wechat: {
      enabled: wechat.enabled,
      hasAppId: !!wechat.appId,
      hasMchId: !!wechat.mchId,
      hasPrivateKey: !!wechat.privateKey,
      hasPublicKey: !!wechat.publicKey,
    },
  };
}

module.exports = { baseUrl, wechat, alipay, getConfigCheck };
