import { login } from "./api.js";
import { saveAuth } from "./auth.js";

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

function redirectToPage(role) {
  const redirect = sessionStorage.getItem("loginRedirect");
  if (redirect) {
    sessionStorage.removeItem("loginRedirect");
    window.location.href = redirect;
    return;
  }
  if (role === "admin") {
    window.location.href = "admin.html";
  } else if (role === "member") {
    window.location.href = "member.html";
  } else {
    window.location.reload();
  }
}

function renderHeaderAuth() {
  const container = document.getElementById("auth-header-container");
  if (!container) return;

  // 首页右上角始终显示「登录/注册」，不显示已登录用户名和退出，避免多窗口时另一窗口也显示「cgq 退出」
  container.innerHTML = `
    <button id="login-btn" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg">
      登录 / 注册
    </button>
  `;
  const loginBtn = document.getElementById("login-btn");
  const freeCourseBtn = document.getElementById("free-course-btn");
  const backdrop = document.getElementById("login-modal-backdrop");
  const closeBtn = document.getElementById("login-modal-close");
  function openLoginModal(redirectAfterLogin) {
    if (redirectAfterLogin) sessionStorage.setItem("loginRedirect", redirectAfterLogin);
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  if (loginBtn && backdrop) {
    loginBtn.addEventListener("click", () => openLoginModal(null));
  }
  if (freeCourseBtn && backdrop) {
    freeCourseBtn.addEventListener("click", () => openLoginModal("courses.html?filter=free"));
  }
  function closeLoginModal() {
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }
  if (closeBtn) closeBtn.addEventListener("click", closeLoginModal);
  if (backdrop) backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeLoginModal();
  });
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape" && backdrop && !backdrop.classList.contains("hidden")) {
      closeLoginModal();
    }
  });
}

function initLoginForm() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

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
      redirectToPage(data.role);
    } catch (err) {
      const isNetworkError =
        err.message === "Failed to fetch" ||
        err.name === "TypeError";
      let msg = isNetworkError
        ? "无法连接服务器。请先在本机启动：在 backend 目录执行 node app.js，然后在浏览器打开 http://localhost:3000"
        : (err.message || "登录失败，请重试");
      
      // 检查是否需要注册
      if (err.needRegister || err.message === "您还没有注册" || err.message.includes("还没有注册")) {
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

// 入口：页面加载后更新头部并绑定表单
renderHeaderAuth();
initLoginForm();
