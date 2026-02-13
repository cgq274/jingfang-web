import { login } from "./api.js";
import { saveAuth, isLoggedIn } from "./auth.js";

const REDIRECT_MEMBER = "member.html";

function showMessage(text, type) {
  const loginMessage = document.getElementById("login-message");
  const messageText = document.getElementById("message-text");
  const msgInner = document.getElementById("login-message-inner");
  if (!loginMessage || !messageText || !msgInner) return;

  messageText.textContent = text;
  let innerCls = "p-4 rounded-lg border ";
  let textCls = "text-blue-800";
  if (type === "error") {
    innerCls += "bg-red-50 border-red-200";
    textCls = "text-red-800";
  } else if (type === "success") {
    innerCls += "bg-green-50 border-green-200";
    textCls = "text-green-800";
  } else {
    innerCls += "bg-blue-50 border-blue-200";
  }
  msgInner.className = innerCls;
  messageText.className = textCls;
  loginMessage.classList.remove("hidden");
  if (type !== "info") {
    setTimeout(() => loginMessage.classList.add("hidden"), 5000);
  }
}

function redirectAfterLogin(role) {
  const redirect = sessionStorage.getItem("loginRedirect");
  if (redirect) {
    sessionStorage.removeItem("loginRedirect");
    window.location.href = redirect;
    return;
  }
  if (role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = REDIRECT_MEMBER;
  }
}

function openLoginModal(redirectUrl) {
  if (redirectUrl) sessionStorage.setItem("loginRedirect", redirectUrl);
  const backdrop = document.getElementById("login-modal-backdrop");
  if (backdrop) {
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeLoginModal() {
  const backdrop = document.getElementById("login-modal-backdrop");
  if (backdrop) {
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

function initEnterLearningBtn() {
  const btn = document.getElementById("enter-learning-btn");
  const backdrop = document.getElementById("login-modal-backdrop");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    if (isLoggedIn()) return;
    e.preventDefault();
    sessionStorage.setItem("loginRedirect", REDIRECT_MEMBER);
    openLoginModal(REDIRECT_MEMBER);
  });
}

function initLoginModalClose() {
  const closeBtn = document.getElementById("login-modal-close");
  const backdrop = document.getElementById("login-modal-backdrop");
  if (closeBtn) closeBtn.addEventListener("click", closeLoginModal);
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeLoginModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.classList.contains("hidden")) {
      closeLoginModal();
    }
  });
}

function initLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usernameEl = document.getElementById("login-username");
    const passwordEl = document.getElementById("login-password");
    const username = usernameEl?.value?.trim();
    const password = passwordEl?.value?.trim();

    if (!username || !password) {
      showMessage("请输入用户名和密码", "error");
      return;
    }

    const submitBtn = document.getElementById("submit-login");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "登录中...";
    }

    try {
      const data = await login(username, password);
      saveAuth(data.token, data.role, data.username);
      redirectAfterLogin(data.role);
    } catch (err) {
      const isNetworkError = err.message === "Failed to fetch" || err.name === "TypeError";
      let msg = isNetworkError
        ? "无法连接服务器，请检查后端是否已启动。"
        : (err.message || "登录失败，请重试");
      if (err.needRegister || (err.message && err.message.includes("还没有注册"))) {
        msg = "您还没有注册，请先注册账号";
      }
      showMessage(msg, "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "登录";
      }
    }
  });
}

function renderHeaderAuth() {
  const container = document.getElementById("courses-header-auth");
  if (!container) return;

  // 课程页右上角始终显示「进入学习中心」，不显示已登录用户名，与首页一致
  container.innerHTML = `
    <a href="member.html" id="enter-learning-btn" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg">
      进入学习中心
    </a>
  `;
  initEnterLearningBtn();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeaderAuth();
  initLoginModalClose();
  initLoginForm();
});
