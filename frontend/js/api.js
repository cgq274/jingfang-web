// 与后端同源时用相对路径，避免跨域与“无法连接服务器”
import { clearAuth } from "./auth.js";

const BASE_URL = "/api";

export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 解析响应：若 401 则清除登录并抛出带 needReLogin 的错误 */
async function parseRes(res) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearAuth();
    const err = new Error(data.message || "登录已过期，请重新登录");
    err.needReLogin = true;
    throw err;
  }
  return data;
}

/**
 * 登录
 * @returns {Promise<{ message, token, role, username }>}
 */
export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "登录失败");
    error.needRegister = data.needRegister === true;
    throw error;
  }
  return data;
}

/**
 * 获取当前用户信息（需已登录）
 */
export async function getMe() {
  const res = await fetch(`${BASE_URL}/me`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "未登录");
  return data;
}

// ---------- 学员课程与订单 ----------

/** 我的课程列表 */
export async function getMyCourses() {
  const res = await fetch(`${BASE_URL}/member/courses`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "获取我的课程失败");
  return data;
}

/** 检查是否已拥有某课程 */
export async function checkCourseOwned(courseId) {
  const res = await fetch(`${BASE_URL}/member/courses/${courseId}/owned`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  return res.ok && data.owned === true;
}

/** 免费课程：加入 */
export async function enrollCourse(courseId) {
  const res = await fetch(`${BASE_URL}/member/courses/${courseId}/enroll`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "加入失败");
  return data;
}

/** 创建订单（收费课程） */
export async function createOrder(courseId) {
  const res = await fetch(`${BASE_URL}/member/orders`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ courseId }),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "创建订单失败");
  return data;
}

/** 查询订单状态 */
export async function getOrder(orderId) {
  const res = await fetch(`${BASE_URL}/member/orders/${orderId}`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "查询订单失败");
  return data;
}

/** 模拟支付确认（测试用） */
export async function confirmMockPay(orderId) {
  const res = await fetch(`${BASE_URL}/member/orders/${orderId}/confirm-mock`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "支付失败");
  return data;
}

/** 支付方式是否可用（微信/支付宝） */
export async function getPaymentStatus() {
  const res = await fetch(`${BASE_URL}/payment/status`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  if (!res.ok) return { wechat: false, alipay: false };
  return { wechat: !!data.wechat, alipay: !!data.alipay };
}

/** 创建微信 Native 支付，返回 code_url 用于生成二维码 */
export async function createWechatPay(orderId) {
  const res = await fetch(`${BASE_URL}/payment/wechat/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "微信下单失败");
  return data;
}

/** 创建支付宝电脑网站支付，返回支付链接 */
export async function createAlipayPay(orderId) {
  const res = await fetch(`${BASE_URL}/payment/alipay/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "支付宝下单失败");
  return data;
}

/** 上报视频观看进度（根据真实观看更新学习进度与成就） */
export async function saveProgress(courseId, videoId, currentTime, duration) {
  const res = await fetch(`${BASE_URL}/member/progress`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ courseId, videoId, currentTime, duration }),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "保存进度失败");
  return data;
}

/** 学习统计与成就（会员中心学习进度、学习统计、学习成就） */
export async function getMemberStats() {
  const res = await fetch(`${BASE_URL}/member/stats`, { headers: getAuthHeaders() });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "获取学习统计失败");
  return data;
}

// ---------- 会员订单 ----------

/** 创建会员订单（annual/monthly/quarterly） */
export async function createMembershipOrder(planCode = "annual") {
  const res = await fetch(`${BASE_URL}/member/memberships/orders`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ planCode }),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "创建会员订单失败");
  return data;
}

/** 模拟支付确认会员订单（测试用） */
export async function confirmMembershipMockPay(orderId) {
  const res = await fetch(`${BASE_URL}/member/memberships/orders/${orderId}/confirm-mock`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await parseRes(res);
  if (!res.ok) throw new Error(data.message || "会员支付失败");
  return data;
}
