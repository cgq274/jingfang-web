import { requireRole, logout, getUsername } from "./auth.js";

// 仅管理员可访问
requireRole("admin");

// 设置右上角管理员名称
const usernameSpan = document.getElementById("admin-username");
const currentUsername = getUsername();
if (usernameSpan && currentUsername) {
  usernameSpan.textContent = currentUsername;
}

// 退出按钮
document.getElementById("logout-btn")?.addEventListener("click", () => {
  if (confirm("确定要退出登录吗？")) logout();
});
