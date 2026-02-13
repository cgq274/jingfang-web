import { getToken, requireRole } from "./auth.js";

const API_BASE = "/api";

// 仅管理员可访问
requireRole("admin");

function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

const params = new URLSearchParams(window.location.search);
const editId = params.get("id");
const isEditMode = !!editId;

const form = document.getElementById("course-create-form");
const submitBtn = document.getElementById("course-submit-btn");
const headerEl = document.getElementById("course-form-header");

if (isEditMode && headerEl) {
  headerEl.style.display = "none";
  document.title = "敬方教育 - 编辑课程";
}

async function loadCourseForEdit(id) {
  const res = await fetch(`${API_BASE}/courses`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("获取课程列表失败");
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const course = items.find((c) => String(c.id) === String(id));
  if (!course) throw new Error("未找到该课程");
  return course;
}

function fillForm(course) {
  const titleEl = document.getElementById("course-title");
  const categoryEl = document.getElementById("course-category");
  const priceEl = document.getElementById("course-price");
  const statusEl = document.getElementById("course-status");
  const descriptionEl = document.getElementById("course-description");
  if (titleEl) titleEl.value = course.title || "";
  if (categoryEl) categoryEl.value = course.category || "";
  if (priceEl) priceEl.value = course.price != null ? String(course.price) : "0";
  if (statusEl) statusEl.value = course.status || "published";
  if (descriptionEl) descriptionEl.value = course.description || "";
}

function setSubmitButtonLabel(text, icon) {
  if (!submitBtn) return;
  submitBtn.innerHTML = "";
  if (icon) {
    const i = document.createElement("iconify-icon");
    i.setAttribute("icon", icon);
    i.className = "text-lg";
    submitBtn.appendChild(i);
  }
  submitBtn.appendChild(document.createTextNode(text));
}

if (isEditMode) {
  setSubmitButtonLabel("保存修改", "heroicons:pencil-square");
  loadCourseForEdit(editId)
    .then(fillForm)
    .catch((err) => {
      console.error(err);
      alert("加载课程信息失败");
    });
} else if (submitBtn) {
  setSubmitButtonLabel("创建课程", "heroicons:plus");
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleEl = document.getElementById("course-title");
    const categoryEl = document.getElementById("course-category");
    const priceEl = document.getElementById("course-price");
    const statusEl = document.getElementById("course-status");
    const descriptionEl = document.getElementById("course-description");

    const title = titleEl?.value?.trim();
    if (!title) {
      alert("请输入课程名称");
      return;
    }
    const category = categoryEl?.value?.trim() || null;
    const price =
      priceEl?.value != null && priceEl.value !== "" ? Number(priceEl.value) : 0;
    const status = statusEl?.value || "published";
    const description = descriptionEl?.value?.trim() || null;

    if (submitBtn) {
      submitBtn.disabled = true;
      const origText = submitBtn.textContent;
      submitBtn.textContent = "提交中...";
    }

    try {
      if (isEditMode) {
        const res = await fetch(`${API_BASE}/courses/${editId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, category, price, status, description }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `更新失败：${res.status}`);
        }
        alert("课程已更新");
      } else {
        const res = await fetch(`${API_BASE}/courses`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, category, price, status, description }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `创建失败：${res.status}`);
        }
        alert("课程已创建");
      }
      window.location.href = "admin.html";
    } catch (err) {
      console.error(err);
      alert(isEditMode ? "更新课程失败，请检查网络或联系管理员。" : "创建课程失败，请检查网络或联系管理员。");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (isEditMode) {
          setSubmitButtonLabel("保存修改", "heroicons:pencil-square");
        } else {
          setSubmitButtonLabel("创建课程", "heroicons:plus");
        }
      }
    }
  });
}
