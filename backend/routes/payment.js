/**
 * 支付路由：微信 Native、支付宝电脑网站支付创建与回调
 */
const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const paymentService = require("../services/payment");
const { getConfigCheck } = require("../config/payment");

const router = express.Router();

/** 仅用于排查：当前支付配置是否齐全（不返回敏感信息，无需登录） */
router.get("/payment/config-check", (req, res) => {
  res.json(getConfigCheck());
});

/** 创建微信 Native 支付（返回 code_url 供前端生成二维码） */
router.post("/payment/wechat/create", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const orderId = parseInt(req.body.orderId, 10);
  if (!orderId) {
    return res.status(400).json({ message: "订单 ID 无效" });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id, user_id, course_id, amount, status FROM orders WHERE id = ? AND user_id = ?",
      [orderId, userId]
    );
    if (!rows.length) return res.status(404).json({ message: "订单不存在" });
    const order = rows[0];
    if (order.status !== "pending") {
      return res.status(400).json({ message: "订单状态不允许支付" });
    }
    const description = `课程订单-${orderId}`;
    const { codeUrl } = await paymentService.createWechatNativePay(order, description);
    res.json({ codeUrl, orderId });
  } catch (err) {
    console.error("微信下单失败:", err);
    res.status(500).json({ message: err.message || "微信支付下单失败" });
  }
});

/** 创建支付宝电脑网站支付（返回支付链接） */
router.post("/payment/alipay/create", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const orderId = parseInt(req.body.orderId, 10);
  if (!orderId) {
    return res.status(400).json({ message: "订单 ID 无效" });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id, user_id, course_id, amount, status FROM orders WHERE id = ? AND user_id = ?",
      [orderId, userId]
    );
    if (!rows.length) return res.status(404).json({ message: "订单不存在" });
    const order = rows[0];
    if (order.status !== "pending") {
      return res.status(400).json({ message: "订单状态不允许支付" });
    }
    const subject = `课程订单-${orderId}`;
    const { payUrl } = await paymentService.createAlipayPagePay(order, subject);
    res.json({ payUrl, orderId });
  } catch (err) {
    console.error("[支付宝下单] 错误:", err.message);
    console.error("[支付宝下单] 堆栈:", err.stack);
    res.status(500).json({
      message: err.message || "支付宝下单失败",
      code: err.code || undefined,
    });
  }
});

/** 支付方式是否可用（供前端隐藏/展示按钮） */
router.get("/payment/status", authMiddleware, (req, res) => {
  res.json({
    wechat: paymentService.wechatEnabled(),
    alipay: paymentService.alipayEnabled(),
  });
});

/** 支付宝异步通知（form 表单 POST，body 为 application/x-www-form-urlencoded） */
router.post("/payment/alipay/notify", express.urlencoded({ extended: true }), async (req, res) => {
  await paymentService.handleAlipayNotify(req.body, res);
});

module.exports = router;
module.exports.handleWechatNotify = paymentService.handleWechatNotify;
