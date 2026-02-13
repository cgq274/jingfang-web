/**
 * 支付服务：微信支付 Native、支付宝电脑网站支付及回调处理
 */
const { pool } = require("../config/db");
const { wechat: wechatConfig, alipay: alipayConfig } = require("../config/payment");

/** 根据第三方支付回调确认订单并写入 user_courses（供微信/支付宝回调使用） */
async function confirmOrderPaid(orderId, paymentMethod, paymentId) {
  const [rows] = await pool.execute(
    "SELECT id, user_id, course_id, status FROM orders WHERE id = ?",
    [orderId]
  );
  if (!rows.length) return { ok: false, message: "订单不存在" };
  const order = rows[0];
  if (order.status === "paid") return { ok: true, message: "已支付", courseId: order.course_id };
  if (order.status !== "pending") return { ok: false, message: "订单状态不允许支付" };

  await pool.execute(
    "UPDATE orders SET status = 'paid', payment_method = ?, payment_id = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?",
    [paymentMethod, paymentId || null, orderId]
  );
  await pool.execute(
    "INSERT IGNORE INTO user_courses (user_id, course_id, source, order_id) VALUES (?, ?, 'paid', ?)",
    [order.user_id, order.course_id, orderId]
  );
  return { ok: true, courseId: order.course_id };
}

/**
 * 微信 Native 下单，返回 code_url 供前端生成二维码
 * @param {{ id: number, user_id: number, course_id: number, amount: number }} order
 * @param {string} description - 商品描述
 */
async function createWechatNativePay(order, description) {
  if (!wechatConfig.enabled || !wechatConfig.appId || !wechatConfig.mchId || !wechatConfig.privateKey || !wechatConfig.publicKey) {
    throw new Error("微信支付未配置或未启用，请设置 WECHAT_PAY_ENABLED、WECHAT_APP_ID、WECHAT_MCH_ID 及证书");
  }
  const WxPay = require("wechatpay-node-v3");
  const pay = new WxPay({
    appid: wechatConfig.appId,
    mchid: wechatConfig.mchId,
    publicKey: wechatConfig.publicKey,
    privateKey: wechatConfig.privateKey,
    key: wechatConfig.apiV3Key || undefined,
  });
  const totalCents = Math.round(Number(order.amount) * 100);
  const outTradeNo = `ORD${order.id}`;
  const params = {
    description: description || `课程订单-${order.id}`,
    out_trade_no: outTradeNo,
    notify_url: wechatConfig.notifyUrl,
    amount: { total: totalCents, currency: "CNY" },
  };
  const result = await pay.transactions_native(params);
  if (result.status !== 200 || !result.code_url) {
    throw new Error(result.message || "微信下单失败");
  }
  return { codeUrl: result.code_url, outTradeNo };
}

/**
 * 微信支付回调验签并解密，确认订单后返回 200 与规定 JSON
 */
async function handleWechatNotify(rawBody, headers, res) {
  if (!wechatConfig.apiV3Key) {
    res.status(500).json({ code: "FAIL", message: "未配置 APIv3 密钥" });
    return;
  }
  const WxPay = require("wechatpay-node-v3");
  const pay = new WxPay({
    appid: wechatConfig.appId,
    mchid: wechatConfig.mchId,
    publicKey: wechatConfig.publicKey,
    privateKey: wechatConfig.privateKey,
    key: wechatConfig.apiV3Key,
  });
  try {
    const signature = headers["wechatpay-signature"];
    const serial = headers["wechatpay-serial"];
    const nonce = headers["wechatpay-nonce"];
    const timestamp = headers["wechatpay-timestamp"];
    if (!signature || !timestamp || !nonce) {
      res.status(401).json({ code: "FAIL", message: "缺少签名头" });
      return;
    }
    const bodyStr = typeof rawBody === "string" ? rawBody : (rawBody && rawBody.toString ? rawBody.toString("utf8") : "");
    const verified = await pay.verifySign({
      timestamp,
      nonce,
      body: bodyStr,
      serial: serial || "",
      signature,
      apiSecret: wechatConfig.apiV3Key,
    });
    if (!verified) {
      res.status(401).json({ code: "FAIL", message: "签名验证失败" });
      return;
    }
    const body = JSON.parse(bodyStr);
    const cipherText = body.resource?.ciphertext;
    const nonceStr = body.resource?.nonce;
    const associatedData = body.resource?.associated_data || "";
    if (!cipherText || !nonceStr) {
      res.status(400).json({ code: "FAIL", message: "回调资源无效" });
      return;
    }
    const event = pay.decipher_gcm(cipherText, associatedData, nonceStr, wechatConfig.apiV3Key);
    if (event.event_type !== "TRANSACTION.SUCCESS") {
      res.status(200).json({ code: "SUCCESS", message: "已忽略" });
      return;
    }
    const outTradeNo = event.out_trade_no || "";
    const transactionId = event.transaction_id || "";
    const orderId = outTradeNo.startsWith("ORD") ? parseInt(outTradeNo.slice(3), 10) : parseInt(outTradeNo, 10);
    if (!orderId) {
      res.status(200).json({ code: "FAIL", message: "无效商户订单号" });
      return;
    }
    const result = await confirmOrderPaid(orderId, "wechat", transactionId);
    if (!result.ok) {
      res.status(200).json({ code: "SUCCESS", message: result.message || "已处理" });
      return;
    }
    res.status(200).json({ code: "SUCCESS", message: "成功" });
  } catch (err) {
    console.error("微信支付回调处理失败:", err);
    res.status(500).json({ code: "FAIL", message: "处理异常" });
  }
}

/**
 * 支付宝电脑网站支付，返回支付链接
 * @param {{ id: number, user_id: number, course_id: number, amount: number }} order
 * @param {string} subject - 订单标题
 */
async function createAlipayPagePay(order, subject) {
  if (!alipayConfig.enabled || !alipayConfig.appId || !alipayConfig.privateKey) {
    throw new Error("支付宝未配置或未启用，请设置 ALIPAY_PAY_ENABLED、ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY");
  }
  const { AlipaySdk } = require("alipay-sdk");
  const alipaySdk = new AlipaySdk({
    appId: alipayConfig.appId,
    privateKey: alipayConfig.privateKey,
    alipayPublicKey: alipayConfig.alipayPublicKey || undefined,
    gateway: alipayConfig.gateway,
    keyType: "PKCS8",
  });
  const outTradeNo = `ORD${order.id}`;
  const totalAmount = Number(order.amount).toFixed(2);
  const bizContent = {
    out_trade_no: outTradeNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    subject: subject || `课程订单-${order.id}`,
    total_amount: totalAmount,
  };
  const url = alipaySdk.pageExecute("alipay.trade.page.pay", "GET", {
    bizContent,
    returnUrl: alipayConfig.returnUrl,
    notifyUrl: alipayConfig.notifyUrl,
  });
  return { payUrl: url, outTradeNo };
}

/**
 * 支付宝异步通知验签并确认订单，成功后返回 "SUCCESS"
 */
async function handleAlipayNotify(postData, res) {
  if (!alipayConfig.enabled || !alipayConfig.alipayPublicKey) {
    res.send("fail");
    return;
  }
  const { AlipaySdk } = require("alipay-sdk");
  const alipaySdk = new AlipaySdk({
    appId: alipayConfig.appId,
    privateKey: alipayConfig.privateKey,
    alipayPublicKey: alipayConfig.alipayPublicKey,
    gateway: alipayConfig.gateway,
    keyType: "PKCS8",
  });
  try {
    const verified = alipaySdk.checkNotifySignV2 ? alipaySdk.checkNotifySignV2(postData) : alipaySdk.checkNotifySign(postData);
    if (!verified) {
      res.send("fail");
      return;
    }
    const tradeStatus = postData.trade_status;
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      res.send("success");
      return;
    }
    const outTradeNo = postData.out_trade_no || "";
    const tradeNo = postData.trade_no || "";
    const orderId = outTradeNo.startsWith("ORD") ? parseInt(outTradeNo.slice(3), 10) : parseInt(outTradeNo, 10);
    if (!orderId) {
      res.send("success");
      return;
    }
    await confirmOrderPaid(orderId, "alipay", tradeNo);
    res.send("success");
  } catch (err) {
    console.error("支付宝回调处理失败:", err);
    res.send("fail");
  }
}

module.exports = {
  confirmOrderPaid,
  createWechatNativePay,
  createAlipayPagePay,
  handleWechatNotify,
  handleAlipayNotify,
  wechatEnabled: () => wechatConfig.enabled && !!wechatConfig.appId && !!wechatConfig.mchId,
  alipayEnabled: () => alipayConfig.enabled && !!alipayConfig.appId && !!alipayConfig.privateKey,
};
