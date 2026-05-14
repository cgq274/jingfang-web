import { getToken, requireRole } from "./auth.js";

const API_BASE = "/api";

requireRole("admin");

function getAuthHeaders(isJson = true) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

/** 从失败响应中取出可读说明（优先 JSON 的 message） */
async function readErrorMessage(res) {
  const text = await res.text();
  if (!text) return `请求失败（HTTP ${res.status}）`;
  try {
    const data = JSON.parse(text);
    if (data && typeof data.message === "string") return data.message;
  } catch (_) {
    /* 非 JSON，如 Nginx 返回的 HTML */
  }
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}

function parseErrorMessageFromText(text, status) {
  if (!text) return `请求失败（HTTP ${status}）`;
  try {
    const data = JSON.parse(text);
    if (data && typeof data.message === "string") return data.message;
  } catch (_) {
    /* ignore */
  }
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}

/**
 * multipart 上传并监听进度（fetch 无法可靠上报上传字节进度）
 * @returns {Promise<unknown>} 解析后的 JSON 或抛出带 message 的 Error
 */
function uploadFormDataWithProgress(url, formData, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.addEventListener("progress", (e) => {
      if (!onProgress) return;
      if (e.lengthComputable && e.total > 0) {
        onProgress(e.loaded, e.total);
      } else {
        onProgress(e.loaded, null);
      }
    });
    xhr.addEventListener("load", () => {
      const text = xhr.responseText || "";
      const status = xhr.status;
      if (status >= 200 && status < 300) {
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch {
          resolve({ raw: text });
        }
      } else {
        reject(new Error(parseErrorMessageFromText(text, status)));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("网络错误，上传中断")));
    xhr.addEventListener("abort", () => reject(new Error("已取消上传")));
    xhr.send(formData);
  });
}

const params = new URLSearchParams(window.location.search);
const editId = params.get("id");
const isEditMode = !!editId;

const form = document.getElementById("video-upload-form");
const submitBtn = document.getElementById("video-submit-btn");
const headerEl = document.getElementById("video-form-header");
const fileSectionEl = document.getElementById("video-file-section");

if (isEditMode) {
  if (headerEl) headerEl.style.display = "none";
  if (fileSectionEl) fileSectionEl.style.display = "none";
  document.title = "敬方教育 - 编辑视频";
}

async function fetchCoursesForSelect() {
  const res = await fetch(`${API_BASE}/courses`, { headers: getAuthHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function fetchVideosList() {
  const res = await fetch(`${API_BASE}/videos`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("获取视频列表失败");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

function fillForm(video) {
  const titleEl = document.getElementById("video-title");
  const courseEl = document.getElementById("video-course");
  const priceEl = document.getElementById("video-price");
  const durationEl = document.getElementById("video-duration");
  const descEl = document.getElementById("video-description");
  if (titleEl) titleEl.value = video.title || "";
  if (courseEl) courseEl.value = video.course || "";
  if (priceEl) priceEl.value = video.price != null ? String(video.price) : "0";
  if (durationEl) durationEl.value = video.durationMinutes != null ? String(video.durationMinutes) : "0";
  if (descEl) descEl.value = video.description || "";
}

function setSubmitButtonLabel(text, icon) {
  if (!submitBtn) return;
  submitBtn.innerHTML = "";
  const i = document.createElement("iconify-icon");
  i.setAttribute("icon", icon);
  i.className = "text-lg";
  submitBtn.appendChild(i);
  submitBtn.appendChild(document.createTextNode(text));
}

async function init() {
  const courseSelect = document.getElementById("video-course");
  if (courseSelect) {
    const courses = await fetchCoursesForSelect();
    courseSelect.innerHTML = '<option value="">请选择课程</option>';
    courses.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.title || "";
      opt.textContent = c.title || "";
      courseSelect.appendChild(opt);
    });
  }

  if (isEditMode) {
    setSubmitButtonLabel("保存修改", "heroicons:pencil-square");
    try {
      const list = await fetchVideosList();
      const video = list.find((v) => String(v.id) === String(editId));
      if (video) fillForm(video);
      else alert("未找到该视频");
    } catch (e) {
      console.error(e);
      alert("加载视频信息失败");
    }
  }
}

init();

if (form) {
  const fileInput = document.getElementById("video-file-input");
  const fileStatus = document.getElementById("video-file-status");
  const progressWrap = document.getElementById("video-upload-progress");
  const progressLabel = document.getElementById("video-upload-progress-label");
  const progressPct = document.getElementById("video-upload-progress-pct");
  const progressBar = document.getElementById("video-upload-progress-bar");

  function setUploadProgressVisible(visible) {
    if (!progressWrap) return;
    progressWrap.classList.toggle("hidden", !visible);
    if (!visible && progressBar && progressPct) {
      progressBar.style.width = "0%";
      progressBar.classList.remove("opacity-60", "animate-pulse");
      progressPct.textContent = "";
    }
  }

  function updateUploadProgress(loaded, total) {
    if (progressBar && progressPct && progressLabel) {
      progressLabel.textContent = "正在上传到服务器…";
      if (total != null && total > 0) {
        progressBar.classList.remove("opacity-60", "animate-pulse");
        const pct = Math.min(100, Math.round((100 * loaded) / total));
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
      } else {
        progressBar.classList.add("opacity-60", "animate-pulse");
        progressBar.style.width = "100%";
        const mb = (loaded / (1024 * 1024)).toFixed(1);
        progressPct.textContent = `已上传 ${mb} MB`;
      }
    }
  }

  if (fileInput && fileStatus) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) fileStatus.textContent = "未选择文件";
      else fileStatus.textContent = `已选择：${file.name}（${(file.size / (1024 * 1024)).toFixed(1)} MB）`;
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("video-title")?.value?.trim();
    if (!title) {
      alert("请输入视频标题");
      return;
    }
    const course = document.getElementById("video-course")?.value?.trim() || null;
    const priceEl = document.getElementById("video-price");
    const durationEl = document.getElementById("video-duration");
    const price = priceEl?.value != null && priceEl.value !== "" ? Number(priceEl.value) : 0;
    const durationMinutes = durationEl?.value != null && durationEl.value !== "" ? Number(durationEl.value) : 0;
    const description = document.getElementById("video-description")?.value?.trim() || null;

    if (submitBtn) {
      submitBtn.disabled = true;
      const willUploadFile = !isEditMode && fileInput?.files?.[0];
      submitBtn.textContent = willUploadFile ? "上传中…" : "提交中...";
    }

    try {
      if (isEditMode) {
        const res = await fetch(`${API_BASE}/videos/${editId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title,
            course,
            price,
            durationMinutes,
            description,
            status: "published",
          }),
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        alert("视频信息已更新");
      } else {
        const file = fileInput?.files?.[0];
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", title);
          if (course != null) formData.append("course", course);
          formData.append("price", String(price));
          formData.append("durationMinutes", String(durationMinutes));
          if (description != null) formData.append("description", description);
          formData.append("status", "published");

          setUploadProgressVisible(true);
          if (progressBar) progressBar.classList.remove("opacity-60", "animate-pulse");

          const token = getToken();
          await uploadFormDataWithProgress(
            `${API_BASE}/videos/upload-file`,
            formData,
            token,
            updateUploadProgress
          );
          if (progressBar && progressPct) {
            progressBar.classList.remove("opacity-60", "animate-pulse");
            progressBar.style.width = "100%";
            progressPct.textContent = "100%";
          }
          alert("视频已上传并保存");
        } else {
          const res = await fetch(`${API_BASE}/videos`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              title,
              course,
              price,
              durationMinutes,
              description,
              status: "published",
            }),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res));
          alert("视频信息已保存");
        }
      }
      window.location.href = "admin.html";
    } catch (err) {
      console.error(err);
      const detail = err && err.message ? String(err.message) : "";
      const base = isEditMode ? "更新视频失败" : "上传或保存视频失败";
      alert(detail ? `${base}：${detail}` : base);
    } finally {
      setUploadProgressVisible(false);
      if (submitBtn) {
        submitBtn.disabled = false;
        if (isEditMode) setSubmitButtonLabel("保存修改", "heroicons:pencil-square");
        else setSubmitButtonLabel("上传视频", "heroicons:cloud-arrow-up");
      }
    }
  });
}
