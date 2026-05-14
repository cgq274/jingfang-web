const COS = require("cos-nodejs-sdk-v5");

/**
 * 腾讯云 COS 配置
 *
 * 强烈建议将 SecretId / SecretKey 存在环境变量中，而不是写死在代码里：
 * - TENCENT_COS_SECRET_ID
 * - TENCENT_COS_SECRET_KEY
 * - TENCENT_COS_BUCKET
 * - TENCENT_COS_REGION
 */
const cosConfig = {
  // 注意：不要在此处写死真实的 SecretId / SecretKey / Bucket / Region
  // 请在部署环境中通过环境变量提供：
  // - TENCENT_COS_SECRET_ID
  // - TENCENT_COS_SECRET_KEY
  // - TENCENT_COS_BUCKET
  // - TENCENT_COS_REGION
  SecretId: process.env.TENCENT_COS_SECRET_ID || "",
  SecretKey: process.env.TENCENT_COS_SECRET_KEY || "",
  Bucket: process.env.TENCENT_COS_BUCKET || "",
  Region: process.env.TENCENT_COS_REGION || "",
};

// 简单检查配置是否填写
function ensureCosConfig() {
  if (!cosConfig.SecretId || !cosConfig.SecretKey || !cosConfig.Bucket || !cosConfig.Region) {
    console.warn(
      "[COS] 配置信息不完整，请在环境变量中设置：TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY / TENCENT_COS_BUCKET / TENCENT_COS_REGION"
    );
  } else if (!isLikelyCosRegion(cosConfig.Region)) {
    console.warn(
      `[COS] TENCENT_COS_REGION="${cosConfig.Region}" 不像地域代码（应为 ap-guangzhou、ap-beijing 等），若与桶名相同会导致上传失败`
    );
  }
}

/** 是否已填写四项 COS 环境变量（不校验密钥是否有效） */
function isCosConfigured() {
  return !!(
    cosConfig.SecretId &&
    cosConfig.SecretKey &&
    cosConfig.Bucket &&
    cosConfig.Region
  );
}

/** 腾讯云 COS 地域一般为 ap- / eu- / na- 等前缀 + 城市代号 */
function isLikelyCosRegion(region) {
  if (!region || typeof region !== "string") return false;
  return /^(ap|eu|na|sa|cn|me|af)-[a-z0-9-]+$/i.test(region.trim());
}

function getCosConfigError() {
  if (!cosConfig.SecretId || !cosConfig.SecretKey) {
    return "服务器未配置 COS 密钥（TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY），无法上传视频";
  }
  if (!cosConfig.Bucket || !cosConfig.Region) {
    return "服务器 COS 桶或地域未配置（TENCENT_COS_BUCKET / TENCENT_COS_REGION）";
  }
  if (!isLikelyCosRegion(cosConfig.Region)) {
    return `COS 地域配置疑似错误：TENCENT_COS_REGION 应为 ap-guangzhou、ap-beijing 等地域代码，不能填写桶名（当前值：${cosConfig.Region}）`;
  }
  return null;
}

ensureCosConfig();

const cosClient = new COS({
  SecretId: cosConfig.SecretId,
  SecretKey: cosConfig.SecretKey,
});

function getPublicUrl(objectKey) {
  if (!objectKey) return "";
  const encodedPath = encodeURIComponent(objectKey).replace(/%2F/g, "/");
  // 若已为 COS 桶绑定 CDN 加速域名，可设置 COS_PLAY_BASE_URL（如 https://video.example.com），新写入的 play_url 将走 CDN
  const baseRaw = process.env.COS_PLAY_BASE_URL || process.env.VIDEO_CDN_BASE_URL || "";
  const base = String(baseRaw).trim().replace(/\/+$/, "");
  if (base) {
    return `${base}/${encodedPath}`;
  }
  return `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${encodedPath}`;
}

/**
 * 生成用于前端直传 COS 的预签名上传 URL
 *
 * @param {Object} options
 * @param {string} options.objectKey 在 COS 中的对象 Key
 * @param {number} [options.expires=600] 有效期，单位秒
 * @returns {Promise<{ uploadUrl: string, playUrl: string }>}
 */
function getPresignedUploadUrl({ objectKey, expires = 600 }) {
  return new Promise((resolve, reject) => {
    if (!objectKey) {
      return reject(new Error("objectKey 不能为空"));
    }

    cosClient.getObjectUrl(
      {
        Bucket: cosConfig.Bucket,
        Region: cosConfig.Region,
        Key: objectKey,
        Method: "PUT",
        Expires: expires,
        Sign: true,
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }

        // 假设桶已配置为「公有读」或经 CDN 暴露，则播放地址可以直接拼出公开 URL
        const playUrl = getPublicUrl(objectKey);

        resolve({
          uploadUrl: data.Url,
          playUrl,
        });
      }
    );
  });
}

module.exports = {
  cosClient,
  cosConfig,
  getPublicUrl,
  getPresignedUploadUrl,
  isCosConfigured,
  getCosConfigError,
};

