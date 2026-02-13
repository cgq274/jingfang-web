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

const SETTING_IDS = {
  siteTitle: "setting-site-title",
  supportPhone: "setting-support-phone",
  supportEmail: "setting-support-email",
  homeAnnouncement: "setting-home-announcement",
  icpNumber: "setting-icp-number",
  footerText: "setting-footer-text",
  footerSlogan: "setting-footer-slogan",
  footerIntro: "setting-footer-intro",
  siteDescription: "setting-site-description",
  siteKeywords: "setting-site-keywords",
};

function getValue(id) {
  const el = document.getElementById(id);
  return el ? (el.tagName === "TEXTAREA" ? el.value : el.value) : "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取系统设置失败：${res.status}`);
    }

    const data = await res.json();
    setValue(SETTING_IDS.siteTitle, data.siteTitle);
    setValue(SETTING_IDS.supportPhone, data.supportPhone);
    setValue(SETTING_IDS.supportEmail, data.supportEmail);
    setValue(SETTING_IDS.homeAnnouncement, data.homeAnnouncement);
    setValue(SETTING_IDS.icpNumber, data.icpNumber);
    setValue(SETTING_IDS.footerText, data.footerText);
    setValue(SETTING_IDS.footerSlogan, data.footerSlogan);
    setValue(SETTING_IDS.footerIntro, data.footerIntro);
    setValue(SETTING_IDS.siteDescription, data.siteDescription);
    setValue(SETTING_IDS.siteKeywords, data.siteKeywords);
  } catch (err) {
    console.error(err);
    alert("加载系统设置失败，请确认已登录且为管理员账号。");
  }
}

async function saveSettings() {
  const payload = {
    siteTitle: getValue(SETTING_IDS.siteTitle),
    supportPhone: getValue(SETTING_IDS.supportPhone),
    supportEmail: getValue(SETTING_IDS.supportEmail),
    homeAnnouncement: getValue(SETTING_IDS.homeAnnouncement),
    icpNumber: getValue(SETTING_IDS.icpNumber),
    footerText: getValue(SETTING_IDS.footerText),
    footerSlogan: getValue(SETTING_IDS.footerSlogan),
    footerIntro: getValue(SETTING_IDS.footerIntro),
    siteDescription: getValue(SETTING_IDS.siteDescription),
    siteKeywords: getValue(SETTING_IDS.siteKeywords),
  };

  const ok = confirm(
    "你正在修改系统设置（敏感操作）\n\n将更新：网站标题、公告、客服电话/邮箱、备案号、底部文案、页脚副标题与简介、SEO 描述与关键词。\n\n确定继续吗？"
  );
  if (!ok) return;
  const typed = prompt("请输入 SAVE 以确认保存系统设置：", "");
  if (typed !== "SAVE") {
    alert("已取消：未通过二次确认");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `保存失败：${res.status}`);
    }

    alert("系统设置已保存");
  } catch (err) {
    console.error(err);
    alert("保存系统设置失败");
  }
}

function init() {
  loadSettings();
  const saveBtn = document.getElementById("settings-save-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveSettings);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
