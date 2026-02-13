import { saveAuth } from "./auth.js";

const API_BASE = "/api";

let countdownTimer = null;
let countdownSeconds = 0;

function showMessage(text, type) {
  const messageDiv = document.getElementById("register-message");
  const messageText = document.getElementById("message-text");
  const msgInner = document.getElementById("register-message-inner");
  if (!messageDiv || !messageText || !msgInner) return;

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
  messageDiv.classList.remove("hidden");

  if (type !== "info") {
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }
}

// 发送验证码
async function sendCode() {
  const phoneInput = document.getElementById("phone");
  const sendCodeBtn = document.getElementById("send-code-btn");
  const phone = phoneInput.value.trim();

  if (!phone) {
    showMessage("请输入手机号", "error");
    return;
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showMessage("手机号格式不正确，请输入11位手机号", "error");
    return;
  }

  if (sendCodeBtn) {
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "发送中...";
  }

  try {
    console.log("发送验证码请求，手机号:", phone);
    const res = await fetch(`${API_BASE}/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    console.log("响应状态:", res.status, res.statusText);
    const data = await res.json().catch((parseError) => {
      console.error("解析响应失败:", parseError);
      return {};
    });
    console.log("响应数据:", data);

    if (!res.ok) {
      const errorMsg = data.message || `发送验证码失败 (${res.status})`;
      console.error("请求失败:", errorMsg, data);
      throw new Error(errorMsg);
    }

    showMessage(`验证码已发送${data.code ? `：${data.code}` : ""}`, "success");

    // 开始倒计时（60秒）
    countdownSeconds = 60;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdownSeconds--;
      if (sendCodeBtn) {
        if (countdownSeconds > 0) {
          sendCodeBtn.textContent = `${countdownSeconds}秒后重发`;
        } else {
          sendCodeBtn.disabled = false;
          sendCodeBtn.textContent = "发送验证码";
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
      }
    }, 1000);
  } catch (err) {
    const isNetworkError =
      err.message === "Failed to fetch" || err.name === "TypeError";
    const msg = isNetworkError
      ? "无法连接服务器。请先在本机启动：在 backend 目录执行 node app.js，然后在浏览器打开 http://localhost:3000"
      : (err.message || "发送验证码失败，请重试");
    showMessage(msg, "error");
    console.error("发送验证码错误:", err);
    if (sendCodeBtn) {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "发送验证码";
    }
  }
}

function redirectToPage(role) {
  if (role === "admin") {
    window.location.href = "admin.html";
  } else if (role === "member") {
    window.location.href = "member.html";
  } else {
    window.location.href = "index.html";
  }
}

// 绑定发送验证码按钮
const sendCodeBtn = document.getElementById("send-code-btn");
if (sendCodeBtn) {
  sendCodeBtn.addEventListener("click", sendCode);
}

const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const verificationCode = document.getElementById("verification-code").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    // 验证必填字段
    if (!username || !password || !phone) {
      showMessage("用户名、手机号和密码不能为空", "error");
      return;
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showMessage("手机号格式不正确，请输入11位手机号", "error");
      return;
    }

    // 验证验证码
    if (!verificationCode) {
      showMessage("请输入验证码", "error");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      showMessage("验证码格式不正确，请输入6位数字", "error");
      return;
    }

    // 验证密码长度
    if (password.length < 6) {
      showMessage("密码长度至少6位", "error");
      return;
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      showMessage("两次输入的密码不一致", "error");
      return;
    }

    // 验证邮箱格式（如果填写了）
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("邮箱格式不正确", "error");
      return;
    }

    const submitBtn = document.getElementById("submit-register");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "注册中...";
    }
    showMessage("正在注册...", "info");

    try {
      console.log("发送注册请求...", { username, phone, hasVerificationCode: !!verificationCode });
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          phone,
          verificationCode,
          email: email || null,
          password,
        }),
      });

      console.log("注册响应状态:", res.status, res.statusText);
      const data = await res.json().catch((parseError) => {
        console.error("解析注册响应失败:", parseError);
        return {};
      });
      console.log("注册响应数据:", data);
      
      if (!res.ok) {
        const errorMsg = data.message || `注册失败 (${res.status})`;
        console.error("注册失败:", errorMsg, data);
        throw new Error(errorMsg);
      }

      // 注册成功，保存登录信息
      saveAuth(data.token, data.role, data.username);
      showMessage("注册成功！正在跳转...", "success");
      setTimeout(() => redirectToPage(data.role), 1000);
    } catch (err) {
      const isNetworkError =
        err.message === "Failed to fetch" || err.name === "TypeError";
      const msg = isNetworkError
        ? "无法连接服务器。请先在本机启动：在 backend 目录执行 node app.js，然后在浏览器打开 http://localhost:3000"
        : err.message || "注册失败，请重试";
      showMessage(msg, "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "立即注册";
      }
    }
  });
}
