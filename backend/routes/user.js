const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

// 获取用户列表（仅管理员，支持筛选和分页）
router.get("/users", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问用户列表" });
  }

  try {
    const { page = 1, limit = 20, role, status, keyword } = req.query;
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offsetInt = (pageInt - 1) * limitInt;

    let query = "SELECT id, username, phone, email, role, status, created_at AS createdAt FROM users WHERE 1=1";
    const params = [];

    // 筛选条件
    if (role && ["admin", "member"].includes(role)) {
      query += " AND role = ?";
      params.push(role);
    }
    if (status && ["active", "disabled"].includes(status)) {
      query += " AND status = ?";
      params.push(status);
    }
    if (keyword) {
      query += " AND (username LIKE ? OR phone LIKE ? OR email LIKE ?)";
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    // 获取总数
    let countQuery = query.replace(/SELECT.*FROM/, "SELECT COUNT(*) AS total FROM");
    const [[countRow]] = await pool.execute(countQuery, params);
    const total = countRow.total || 0;

    // 获取分页数据
    query += ` ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
    const [rows] = await pool.execute(query, params);

    res.json({
      items: rows,
      total,
      page: pageInt,
      limit: limitInt,
      totalPages: Math.ceil(total / limitInt),
    });
  } catch (err) {
    console.error("获取用户列表失败:", err);
    res.status(500).json({ message: "获取用户列表失败" });
  }
});

// 获取用户统计（仅管理员）
router.get("/users/stats", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问用户统计" });
  }

  try {
    const [[totalRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users");
    const [[adminRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    const [[memberRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'member'");
    const [[todayRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE DATE(created_at) = CURDATE()"
    );
    const [[activeRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE status = 'active'");

    res.json({
      total: totalRow.total || 0,
      admins: adminRow.total || 0,
      members: memberRow.total || 0,
      todayNew: todayRow.total || 0,
      active: activeRow.total || 0,
    });
  } catch (err) {
    console.error("获取用户统计失败:", err);
    res.status(500).json({ message: "获取用户统计失败" });
  }
});

// 获取单个用户详情（仅管理员）
router.get("/users/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问用户详情" });
  }

  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      "SELECT id, username, phone, email, role, status, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("获取用户详情失败:", err);
    res.status(500).json({ message: "获取用户详情失败" });
  }
});

// 更新用户信息（仅管理员，支持更新用户名、手机号、邮箱、角色、状态）
router.put("/users/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限修改用户信息" });
  }

  const { id } = req.params;
  const { username, phone, email, role, status } = req.body;

  // 管理员不能修改自己为普通用户或禁用自己，避免把自己锁死
  if (Number(id) === req.user.id) {
    if (role && role === "member") {
      return res.status(400).json({ message: "不能修改当前登录管理员自己的角色" });
    }
    if (status && status === "disabled") {
      return res.status(400).json({ message: "不能禁用当前登录的管理员账号" });
    }
  }

  try {
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (username !== undefined) {
      updateFields.push("username = ?");
      updateValues.push(username);
    }
    if (phone !== undefined) {
      updateFields.push("phone = ?");
      updateValues.push(phone);
    }
    if (email !== undefined) {
      updateFields.push("email = ?");
      updateValues.push(email || null);
    }
    if (role !== undefined) {
      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ message: "角色必须为 admin 或 member" });
      }
      updateFields.push("role = ?");
      updateValues.push(role);
    }
    if (status !== undefined) {
      if (!["active", "disabled"].includes(status)) {
        return res.status(400).json({ message: "状态必须为 active 或 disabled" });
      }
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "请提供要更新的字段" });
    }

    updateValues.push(id);

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    const [result] = await pool.execute(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // 获取用户信息用于日志
    const [userRows] = await pool.execute("SELECT username FROM users WHERE id = ?", [id]);
    const targetUsername = userRows.length > 0 ? userRows[0].username : null;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "user",
      resourceId: Number(id),
      resourceTitle: targetUsername,
      details: { username, phone, email, role, status },
      req,
    });

    res.json({ message: "用户信息已更新" });
  } catch (err) {
    console.error("更新用户信息失败:", err);
    if (err.code === "ER_DUP_ENTRY") {
      if (err.sqlMessage && err.sqlMessage.includes("username")) {
        return res.status(409).json({ message: "用户名已被使用" });
      }
      if (err.sqlMessage && err.sqlMessage.includes("phone")) {
        return res.status(409).json({ message: "手机号已被使用" });
      }
      if (err.sqlMessage && err.sqlMessage.includes("email")) {
        return res.status(409).json({ message: "邮箱已被使用" });
      }
      return res.status(409).json({ message: "信息冲突，请检查用户名、手机号或邮箱是否重复" });
    }
    res.status(500).json({ message: "更新用户信息失败" });
  }
});

// 更新用户角色（仅管理员，保留此接口以兼容旧代码）
router.put("/users/:id/role", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限修改用户角色" });
  }

  const { id } = req.params;
  const { role } = req.body;

  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ message: "角色必须为 admin 或 member" });
  }

  // 管理员不能修改自己为普通用户，避免把自己锁死
  if (Number(id) === req.user.id) {
    return res.status(400).json({ message: "不能修改当前登录管理员自己的角色" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // 获取用户信息用于日志
    const [userRows] = await pool.execute("SELECT username FROM users WHERE id = ?", [id]);
    const targetUsername = userRows.length > 0 ? userRows[0].username : null;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "user",
      resourceId: Number(id),
      resourceTitle: targetUsername,
      details: { role },
      req,
    });

    res.json({ message: "角色已更新" });
  } catch (err) {
    console.error("更新用户角色失败:", err);
    res.status(500).json({ message: "更新用户角色失败" });
  }
});

// 更新用户状态（启用/禁用，仅管理员）
router.put("/users/:id/status", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限修改用户状态" });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ message: "状态必须为 active 或 disabled" });
  }

  // 管理员不能禁用自己
  if (Number(id) === req.user.id && status === "disabled") {
    return res.status(400).json({ message: "不能禁用当前登录的管理员账号" });
  }

  try {
    const [result] = await pool.execute("UPDATE users SET status = ? WHERE id = ?", [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // 获取用户信息用于日志
    const [userRows] = await pool.execute("SELECT username FROM users WHERE id = ?", [id]);
    const targetUsername = userRows.length > 0 ? userRows[0].username : null;

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "user",
      resourceId: Number(id),
      resourceTitle: targetUsername,
      details: { status },
      req,
    });

    res.json({ message: "用户状态已更新" });
  } catch (err) {
    console.error("更新用户状态失败:", err);
    res.status(500).json({ message: "更新用户状态失败" });
  }
});

// 批量更新用户（批量修改角色或状态，仅管理员）
router.put("/users/batch", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限批量操作用户" });
  }

  const { userIds, role, status } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: "请提供要操作的用户ID列表" });
  }

  if (!role && !status) {
    return res.status(400).json({ message: "请提供要修改的字段（role 或 status）" });
  }

  // 不能批量操作自己
  if (userIds.includes(String(req.user.id)) || userIds.includes(Number(req.user.id))) {
    return res.status(400).json({ message: "不能批量操作当前登录的管理员账号" });
  }

  try {
    let updateFields = [];
    let updateValues = [];

    if (role && ["admin", "member"].includes(role)) {
      updateFields.push("role = ?");
      updateValues.push(role);
    }
    if (status && ["active", "disabled"].includes(status)) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "无效的更新字段" });
    }

    const placeholders = userIds.map(() => "?").join(",");
    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id IN (${placeholders})`;
    updateValues.push(...userIds);

    const [result] = await pool.execute(query, updateValues);

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "batch_update",
      resourceType: "user",
      details: { userIds, role, status, affectedRows: result.affectedRows },
      req,
    });

    res.json({ message: `已批量更新 ${result.affectedRows} 个用户` });
  } catch (err) {
    console.error("批量更新用户失败:", err);
    res.status(500).json({ message: "批量更新用户失败" });
  }
});

// 删除用户（仅管理员）
router.delete("/users/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限删除用户" });
  }

  const { id } = req.params;

  // 管理员不能删除自己
  if (Number(id) === req.user.id) {
    return res.status(400).json({ message: "不能删除当前登录的管理员账号" });
  }

  try {
    // 先获取用户信息用于日志
    const [userRows] = await pool.execute("SELECT username FROM users WHERE id = ?", [id]);
    const targetUsername = userRows.length > 0 ? userRows[0].username : null;

    const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "delete",
      resourceType: "user",
      resourceId: Number(id),
      resourceTitle: targetUsername,
      req,
    });

    res.json({ message: "用户已删除" });
  } catch (err) {
    console.error("删除用户失败:", err);
    res.status(500).json({ message: "删除用户失败" });
  }
});

module.exports = router;

