const express = require("express");
const { pool } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

// 初始化 settings 表
async function initSettingsTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        \`value\` TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ 系统设置表初始化成功");
  } catch (err) {
    console.error("初始化系统设置表失败:", err.message);
  }
}

initSettingsTable();

async function getSettingsMap() {
  const [rows] = await pool.execute("SELECT `key`, `value` FROM settings");
  const map = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

async function saveSettingsMap(updates) {
  const entries = Object.entries(updates);
  for (const [key, value] of entries) {
    await pool.execute(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value]
    );
  }
}

// 获取系统设置（仅管理员）
router.get("/settings", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限访问系统设置" });
  }

  try {
    const map = await getSettingsMap();
    res.json({
      siteTitle: map.siteTitle || "敬方教育 - 金融培训平台",
      supportPhone: map.supportPhone || "400-123-4567",
      supportEmail: map.supportEmail || "",
      homeAnnouncement: map.homeAnnouncement || "",
      icpNumber: map.icpNumber || "",
      footerText: map.footerText || "",
      footerSlogan: map.footerSlogan || "",
      footerIntro: map.footerIntro || "",
      siteDescription: map.siteDescription || "",
      siteKeywords: map.siteKeywords || "",
    });
  } catch (err) {
    console.error("获取系统设置失败:", err);
    res.status(500).json({ message: "获取系统设置失败" });
  }
});

// 更新系统设置（仅管理员）
router.put("/settings", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限修改系统设置" });
  }

  const {
    siteTitle,
    supportPhone,
    supportEmail,
    homeAnnouncement,
    icpNumber,
    footerText,
    footerSlogan,
    footerIntro,
    siteDescription,
    siteKeywords,
  } = req.body || {};

  try {
    const updates = {};
    if (siteTitle != null) updates.siteTitle = String(siteTitle);
    if (supportPhone != null) updates.supportPhone = String(supportPhone);
    if (supportEmail != null) updates.supportEmail = String(supportEmail);
    if (homeAnnouncement != null) updates.homeAnnouncement = String(homeAnnouncement);
    if (icpNumber != null) updates.icpNumber = String(icpNumber);
    if (footerText != null) updates.footerText = String(footerText);
    if (footerSlogan != null) updates.footerSlogan = String(footerSlogan);
    if (footerIntro != null) updates.footerIntro = String(footerIntro);
    if (siteDescription != null) updates.siteDescription = String(siteDescription);
    if (siteKeywords != null) updates.siteKeywords = String(siteKeywords);

    await saveSettingsMap(updates);

    // 记录操作日志
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: "update",
      resourceType: "settings",
      details: updates,
      req,
    });

    res.json({ message: "系统设置已保存" });
  } catch (err) {
    console.error("更新系统设置失败:", err);
    res.status(500).json({ message: "更新系统设置失败" });
  }
});

// 前台公共接口：获取公开设置（无需登录，禁止缓存以确保拿到最新设置）
router.get("/public-settings", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const map = await getSettingsMap();
    const supportEmail = (map.supportEmail !== undefined && map.supportEmail !== null)
      ? String(map.supportEmail)
      : "";
    res.json({
      siteTitle: map.siteTitle || "敬方教育 - 金融培训平台",
      supportPhone: map.supportPhone || "400-123-4567",
      supportEmail,
      homeAnnouncement: map.homeAnnouncement || "",
      icpNumber: map.icpNumber || "",
      footerText: map.footerText || "",
      footerSlogan: map.footerSlogan || "",
      footerIntro: map.footerIntro || "",
      siteDescription: map.siteDescription || "",
      siteKeywords: map.siteKeywords || "",
    });
  } catch (err) {
    console.error("获取公开系统设置失败:", err);
    res.status(500).json({ message: "获取公开设置失败" });
  }
});

module.exports = router;

