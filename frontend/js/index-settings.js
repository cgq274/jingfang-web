// 使用当前页面 origin，确保与后端同源时请求正确
const API_BASE = typeof window !== "undefined" && window.location?.origin
  ? `${window.location.origin}/api`
  : "/api";

async function loadPublicSettings() {
  try {
    const res = await fetch(`${API_BASE}/public-settings?_t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;

    const data = await res.json();

    if (data.siteTitle != null && data.siteTitle !== "") {
      document.title = data.siteTitle;
      const headerTitle = document.querySelector("#main-header-root h1");
      if (headerTitle) {
        headerTitle.textContent = data.siteTitle.replace(/ - .+$/, "");
      }
    }

    const announcementBar = document.getElementById("home-announcement-bar");
    if (announcementBar) {
      announcementBar.textContent = data.homeAnnouncement ?? "";
      if (data.homeAnnouncement != null && data.homeAnnouncement !== "") {
        announcementBar.classList.remove("hidden");
      } else {
        announcementBar.classList.add("hidden");
      }
    }

    const footerPhone = document.getElementById("footer-phone");
    if (footerPhone) footerPhone.textContent = String(data.supportPhone ?? "");

    // 页脚「联系我们」邮箱：始终用接口返回的 supportEmail 更新
    const footerEmail = document.getElementById("footer-email");
    if (footerEmail) {
      const email = (data.supportEmail != null && data.supportEmail !== undefined)
        ? String(data.supportEmail).trim()
        : "";
      footerEmail.textContent = email;
      footerEmail.style.display = email ? "" : "inline";
    }

    const footerCopyright = document.getElementById("footer-copyright");
    if (footerCopyright) footerCopyright.textContent = data.footerText ?? "";

    // 页脚公司名：与网站标题一致（去掉「 - 后缀」的短名）
    const footerSiteName = document.getElementById("footer-site-name");
    if (footerSiteName && data.siteTitle != null && String(data.siteTitle).trim() !== "") {
      const shortTitle = String(data.siteTitle).replace(/\s*-\s*.+$/, "").trim() || data.siteTitle;
      footerSiteName.textContent = shortTitle;
    }
    const footerSloganEl = document.getElementById("footer-slogan");
    if (footerSloganEl) footerSloganEl.textContent = data.footerSlogan ?? "";
    const footerIntroEl = document.getElementById("footer-intro");
    if (footerIntroEl) footerIntroEl.textContent = data.footerIntro ?? "";

    const footerIcp = document.getElementById("footer-icp");
    if (footerIcp) {
      footerIcp.textContent = data.icpNumber ?? "";
      if (data.icpNumber != null && data.icpNumber !== "") {
        footerIcp.classList.remove("hidden");
      } else {
        footerIcp.classList.add("hidden");
      }
    }

    if (data.siteDescription != null) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = data.siteDescription ?? "";
    }
    if (data.siteKeywords != null) {
      let meta = document.querySelector('meta[name="keywords"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "keywords";
        document.head.appendChild(meta);
      }
      meta.content = data.siteKeywords ?? "";
    }
  } catch (err) {
    console.error("加载公开设置失败:", err);
  }
}

// 模块脚本可能在 DOMContentLoaded 之后才执行，需根据 readyState 决定立即执行或监听
function initPublicSettings() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => loadPublicSettings());
  } else {
    loadPublicSettings();
  }
}
initPublicSettings();

// 从其他页面/标签页返回本页时重新拉取公开设置，确保显示最新邮箱等
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadPublicSettings();
  }
});

