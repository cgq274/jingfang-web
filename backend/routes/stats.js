const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// 仪表盘统计（仅管理员）
router.get("/stats/dashboard", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问统计数据" });
  }

  try {
    // 只统计学员数量（不包含管理员）
    const [[userRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'member'"
    );
    const [[videoRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM videos"
    );
    const [[courseRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM courses"
    );

    // 暂无订单表，这里用课程总价和视频总价做一个近似收入
    const [[courseRevenueRow]] = await pool.execute(
      "SELECT IFNULL(SUM(price), 0) AS total FROM courses"
    );
    const [[videoRevenueRow]] = await pool.execute(
      "SELECT IFNULL(SUM(price), 0) AS total FROM videos"
    );

    const totalRevenue =
      Number(courseRevenueRow.total || 0) + Number(videoRevenueRow.total || 0);

    // 近 7 天新增
    const [[newUsersRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'member' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const [[newVideosRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM videos WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const [[newCoursesRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM courses WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );

    res.json({
      totalUsers: userRow.total || 0,
      totalVideos: videoRow.total || 0,
      totalCourses: courseRow.total || 0,
      totalRevenue,
      last7Days: {
        newUsers: newUsersRow.total || 0,
        newVideos: newVideosRow.total || 0,
        newCourses: newCoursesRow.total || 0,
      },
    });
  } catch (err) {
    console.error("获取仪表盘统计失败:", err);
    res.status(500).json({ message: "获取统计数据失败" });
  }
});

// 数据分析 - 近7天趋势、转化率、课程加入人数 TOP5、订单概览（仅管理员）
router.get("/stats/analytics", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问统计数据" });
  }

  try {
    // 课程加入人数 TOP5（更有业务价值：哪些课程最受欢迎）
    const [topEnrolledCourses] = await pool.execute(
      `SELECT 
         c.id,
         c.title,
         COUNT(uc.user_id) AS enrollCount
       FROM courses c
       LEFT JOIN user_courses uc ON uc.course_id = c.id
       GROUP BY c.id, c.title
       ORDER BY enrollCount DESC
       LIMIT 5`
    );

    // 近 7 天每日新增趋势（用户、课程、视频）
    const [usersByDay] = await pool.execute(
      `SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM users 
       WHERE role = 'member' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(created_at)`
    );
    const [coursesByDay] = await pool.execute(
      `SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM courses 
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(created_at)`
    );
    const [videosByDay] = await pool.execute(
      `SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM videos 
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(created_at)`
    );
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, newUsers: 0, newCourses: 0, newVideos: 0 };
    }
    usersByDay.forEach((r) => {
      const k = r.d ? String(r.d).slice(0, 10) : null;
      if (k && dayMap[k]) dayMap[k].newUsers = r.cnt || 0;
    });
    coursesByDay.forEach((r) => {
      const k = r.d ? String(r.d).slice(0, 10) : null;
      if (k && dayMap[k]) dayMap[k].newCourses = r.cnt || 0;
    });
    videosByDay.forEach((r) => {
      const k = r.d ? String(r.d).slice(0, 10) : null;
      if (k && dayMap[k]) dayMap[k].newVideos = r.cnt || 0;
    });
    const last7DaysTrend = Object.keys(dayMap)
      .sort()
      .map((k) => dayMap[k]);

    // 转化率：已加入课程学员数 / 总学员数（注册转化），不统计管理员
    const [[totalUsersRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'member'");
    const [[enrolledRow]] = await pool.execute(
      "SELECT COUNT(DISTINCT user_id) AS total FROM user_courses"
    );
    const totalUsers = Number(totalUsersRow?.total ?? 0);
    const enrolledUsers = Number(enrolledRow?.total ?? 0);
    const conversionRate =
      totalUsers > 0 ? Math.round((enrolledUsers / totalUsers) * 1000) / 10 : 0;

    // 订单概览（付费订单数、已支付金额）
    let ordersSummary = { totalOrders: 0, paidRevenue: 0 };
    try {
      const [[ordersCountRow]] = await pool.execute(
        "SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'"
      );
      const [[revenueRow]] = await pool.execute(
        "SELECT IFNULL(SUM(amount), 0) AS total FROM orders WHERE status = 'paid'"
      );
      ordersSummary = {
        totalOrders: Number(ordersCountRow?.total ?? 0),
        paidRevenue: Number(revenueRow?.total ?? 0),
      };
    } catch (_) {
      // orders 表可能未初始化
    }

    res.json({
      topEnrolledCourses,
      last7DaysTrend,
      conversion: {
        totalUsers,
        enrolledUsers,
        conversionRate,
      },
      ordersSummary,
    });
  } catch (err) {
    console.error("获取数据分析失败:", err);
    res.status(500).json({ message: "获取数据分析失败" });
  }
});

module.exports = router;

