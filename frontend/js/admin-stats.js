import { getToken } from "./auth.js";

const API_BASE = "/api";

function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function fetchDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/stats/dashboard`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) return;

    const data = await res.json();

    const totalVideosEl = document.getElementById("stat-total-videos");
    const totalCoursesEl = document.getElementById("stat-total-courses");
    const totalUsersEl = document.getElementById("stat-total-users");
    const totalRevenueEl = document.getElementById("stat-total-revenue");

    if (totalVideosEl) totalVideosEl.textContent = data.totalVideos ?? 0;
    if (totalCoursesEl) totalCoursesEl.textContent = data.totalCourses ?? 0;
    if (totalUsersEl) totalUsersEl.textContent = data.totalUsers ?? 0;
    if (totalRevenueEl) {
      const rev = Number(data.totalRevenue || 0);
      totalRevenueEl.textContent = `¥${rev.toFixed(0)}`;
    }

    const newUsersEl = document.getElementById("stat-last7-new-users");
    const newCoursesEl = document.getElementById("stat-last7-new-courses");
    const newVideosEl = document.getElementById("stat-last7-new-videos");

    if (newUsersEl && data.last7Days) {
      newUsersEl.textContent = `· 本周新增注册用户 ${data.last7Days.newUsers ?? 0} 人`;
    }
    if (newCoursesEl && data.last7Days) {
      newCoursesEl.textContent = `· 本周新增课程 ${data.last7Days.newCourses ?? 0} 个`;
    }
    if (newVideosEl && data.last7Days) {
      newVideosEl.textContent = `· 本周新增视频 ${data.last7Days.newVideos ?? 0} 个`;
    }

    // 近期动态列表（与上方统计卡片数据一致）
    const newUsersTextEl = document.getElementById("stat-last7-new-users-text");
    const newCoursesTextEl = document.getElementById("stat-last7-new-courses-text");
    const newVideosTextEl = document.getElementById("stat-last7-new-videos-text");
    if (data.last7Days) {
      if (newUsersTextEl) newUsersTextEl.textContent = `· 本周新增注册用户 ${data.last7Days.newUsers ?? 0} 人`;
      if (newCoursesTextEl) newCoursesTextEl.textContent = `· 本周新增课程 ${data.last7Days.newCourses ?? 0} 个`;
      if (newVideosTextEl) newVideosTextEl.textContent = `· 本周新增视频 ${data.last7Days.newVideos ?? 0} 个`;
    }
  } catch (err) {
    console.error("加载仪表盘统计失败:", err);
  }
}

let trendChart = null;
let topChart = null;

function renderTrendChart(last7DaysTrend) {
  const el = document.getElementById("analytics-trend-chart");
  if (!el || typeof echarts === "undefined") return;
  if (trendChart) trendChart.dispose();
  trendChart = echarts.init(el);
  const dates = (last7DaysTrend || []).map((d) => d.date.slice(5));
  const option = {
    tooltip: { trigger: "axis" },
    legend: { data: ["新增用户", "新增课程", "新增视频"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: dates },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      { name: "新增用户", type: "line", smooth: true, data: (last7DaysTrend || []).map((d) => d.newUsers), itemStyle: { color: "#3b82f6" } },
      { name: "新增课程", type: "line", smooth: true, data: (last7DaysTrend || []).map((d) => d.newCourses), itemStyle: { color: "#10b981" } },
      { name: "新增视频", type: "line", smooth: true, data: (last7DaysTrend || []).map((d) => d.newVideos), itemStyle: { color: "#8b5cf6" } },
    ],
  };
  trendChart.setOption(option);
}

function renderTopChart(topEnrolledCourses) {
  const el = document.getElementById("analytics-top-chart");
  if (!el || typeof echarts === "undefined") return;
  if (topChart) topChart.dispose();
  topChart = echarts.init(el);
  const titles = (topEnrolledCourses || []).map((c) => (c.title || "").slice(0, 8));
  const counts = (topEnrolledCourses || []).map((c) => Number(c.enrollCount || 0));
  const option = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "5%", containLabel: true },
    xAxis: { type: "category", data: titles, axisLabel: { interval: 0, rotate: titles.some((t) => t.length > 4) ? 15 : 0 } },
    yAxis: { type: "value", minInterval: 1 },
    series: [{ type: "bar", data: counts, itemStyle: { color: "#10b981" }, barMaxWidth: 40 }],
  };
  topChart.setOption(option);
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/stats/analytics`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) return;

    const data = await res.json();

    // 转化率卡片
    const conv = data.conversion || {};
    const rateEl = document.getElementById("analytics-conversion-rate");
    const enrolledEl = document.getElementById("analytics-enrolled-users");
    const totalEl = document.getElementById("analytics-total-users");
    if (rateEl) rateEl.textContent = conv.conversionRate ?? 0;
    if (enrolledEl) enrolledEl.textContent = conv.enrolledUsers ?? 0;
    if (totalEl) totalEl.textContent = conv.totalUsers ?? 0;

    // 订单概览卡片
    const orders = data.ordersSummary || {};
    const revenueEl = document.getElementById("analytics-paid-revenue");
    const ordersEl = document.getElementById("analytics-total-orders");
    if (revenueEl) revenueEl.textContent = Number(orders.paidRevenue ?? 0).toFixed(0);
    if (ordersEl) ordersEl.textContent = orders.totalOrders ?? 0;

    // 近 7 天趋势图
    if (Array.isArray(data.last7DaysTrend)) {
      renderTrendChart(data.last7DaysTrend);
    }

    // 课程加入人数 TOP5（热门课程）图表
    const items = Array.isArray(data.topEnrolledCourses) ? data.topEnrolledCourses : [];
    renderTopChart(items);

    // 热门课程列表
    const listEl = document.getElementById("analytics-top-courses");
    if (listEl) {
      listEl.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "text-gray-500 text-sm";
        li.textContent = "暂无加入数据";
        listEl.appendChild(li);
      } else {
        items.forEach((c) => {
          const li = document.createElement("li");
          li.className = "flex justify-between text-sm text-gray-700";
          li.innerHTML = `<span>${c.title || "-"}</span><span>${Number(c.enrollCount || 0)} 人加入</span>`;
          listEl.appendChild(li);
        });
      }
    }
  } catch (err) {
    console.error("加载数据分析失败:", err);
  }
}

function resizeCharts() {
  trendChart?.resize();
  topChart?.resize();
}

function initStats() {
  fetchDashboardStats();
  fetchAnalytics();
  window.refreshAnalyticsCharts = resizeCharts;
  window.addEventListener("resize", resizeCharts);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStats);
} else {
  initStats();
}

