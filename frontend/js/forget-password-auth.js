const API_BASE = "/api";

let countdownTimer = null;
let countdownSeconds = 0;

function showMessage(text, type) {
  const messageDiv = document.getElementById("fp-message");
  const messageText = document.getElementById("fp-message-text");
  const msgInner = document.getElementById("fp-message-inner");
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

// 发送重置密码验证码
async function sendResetCode() {
  const phoneInput = document.getElementById("fp-phone");
  const sendCodeBtn = document.getElementById("fp-send-code-btn");
  const phone = phoneInput.value.trim();

  if (!phone) {
    showMessage("请输入手机号", "error");
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showMessage("手机号格式不正确，请输入11位手机号", "error");
    return;
  }

  if (sendCodeBtn) {
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "发送中...";
  }

  try {
    const res = await fetch(`${API_BASE}/send-reset-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `发送验证码失败 (${res.status})`);
    }

    showMessage(data.code ? `验证码已发送：${data.code}` : "验证码已发送，请注意查收", "success");

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
      ? "无法连接服务器。请先启动后端：在 backend 目录执行 node app.js"
      : (err.message || "发送验证码失败，请重试");
    showMessage(msg, "error");
    if (sendCodeBtn) {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "发送验证码";
    }
  }
}

// 绑定发送验证码按钮
const sendCodeBtn = document.getElementById("fp-send-code-btn");
if (sendCodeBtn) {
  sendCodeBtn.addEventListener("click", sendResetCode);
}

const forgetPasswordForm = document.getElementById("forget-password-form");
if (forgetPasswordForm) {
  forgetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = document.getElementById("fp-phone").value.trim();
    const verificationCode = document.getElementById("fp-verification-code").value.trim();
    const newPassword = document.getElementById("fp-new-password").value;
    const confirmPassword = document.getElementById("fp-confirm-password").value;

    if (!phone || !verificationCode || !newPassword) {
      showMessage("手机号、验证码和新密码不能为空", "error");
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showMessage("手机号格式不正确，请输入11位手机号", "error");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      showMessage("验证码格式不正确，请输入6位数字", "error");
      return;
    }

    if (newPassword.length < 6) {
      showMessage("密码长度至少6位", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("两次输入的密码不一致", "error");
      return;
    }

    const submitBtn = document.getElementById("fp-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "提交中...";
    }
    showMessage("正在重置密码...", "info");

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          verificationCode,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || `重置密码失败 (${res.status})`);
      }

      showMessage("密码重置成功，请使用新密码登录", "success");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "重置密码";
      }
    } catch (err) {
      const isNetworkError =
        err.message === "Failed to fetch" || err.name === "TypeError";
      const msg = isNetworkError
        ? "无法连接服务器。请先启动后端：在 backend 目录执行 node app.js"
        : (err.message || "重置密码失败，请重试");
      showMessage(msg, "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "重置密码";
      }
    }
  });
}
