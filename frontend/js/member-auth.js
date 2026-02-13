import { logout, getUsername, isLoggedIn, getRole } from "./auth.js";

// 学习中心仅允许学员（member）访问；未登录跳转首页，管理员等非学员角色不可进入
if (!isLoggedIn()) {
  window.location.href = "index.html";
} else if (getRole() !== "member") {
  alert("学习中心仅限学员账号访问，请使用学员账号登录。");
  window.location.href = "index.html";
} else {
  // 设置会员中心用户名显示（当前登录学员）
  const memberNameEl = document.getElementById("member-username");
  const memberWelcomeNameEl = document.getElementById("member-welcome-username");
  const currentUsername = getUsername();

  if (currentUsername) {
    if (memberNameEl) memberNameEl.textContent = currentUsername;
    if (memberWelcomeNameEl) memberWelcomeNameEl.textContent = currentUsername;
  }

  // 返回上一步
  document.getElementById("member-back-btn")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "index.html";
    }
  });

  // 退出按钮
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    if (confirm("确定要退出登录吗？")) logout();
  });
}
