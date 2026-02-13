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
  }
}

ensureCosConfig();

const cosClient = new COS({
  SecretId: cosConfig.SecretId,
  SecretKey: cosConfig.SecretKey,
});

function getPublicUrl(objectKey) {
  if (!objectKey) return "";
  // 注意：这里不对 / 做编码，便于浏览器直接访问
  return `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${encodeURIComponent(
    objectKey
  ).replace(/%2F/g, "/")}`;
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
};

