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
      submitBtn.textContent = "提交中...";
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
        if (!res.ok) throw new Error((await res.text()) || "更新失败");
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

          const res = await fetch(`${API_BASE}/videos/upload-file`, {
            method: "POST",
            headers: getAuthHeaders(false),
            body: formData,
          });
          if (!res.ok) throw new Error((await res.text()) || "上传失败");
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
          if (!res.ok) throw new Error((await res.text()) || "保存失败");
          alert("视频信息已保存");
        }
      }
      window.location.href = "admin.html";
    } catch (err) {
      console.error(err);
      alert(isEditMode ? "更新视频失败" : "上传或保存视频失败");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (isEditMode) setSubmitButtonLabel("保存修改", "heroicons:pencil-square");
        else setSubmitButtonLabel("上传视频", "heroicons:cloud-arrow-up");
      }
    }
  });
}
