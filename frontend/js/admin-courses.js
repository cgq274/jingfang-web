import { getToken } from "./auth.js";

const API_BASE = "/api";

function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

let allCourses = [];
let courseCurrentPage = 1;
let coursePageSize = 10;

function getCourseTotalPages() {
  if (coursePageSize <= 0) return 1;
  return Math.max(1, Math.ceil(allCourses.length / coursePageSize));
}

function getCoursePageItems() {
  const total = allCourses.length;
  if (total === 0) return [];
  const totalPgs = getCourseTotalPages();
  const page = Math.min(courseCurrentPage, totalPgs);
  const start = (page - 1) * coursePageSize;
  return allCourses.slice(start, start + coursePageSize);
}

function updateCoursePaginationUI() {
  const total = allCourses.length;
  const totalPgs = getCourseTotalPages();
  const summaryEl = document.getElementById("course-table-summary");
  const pageInfoEl = document.getElementById("course-page-info");
  const prevBtn = document.getElementById("course-prev-btn");
  const nextBtn = document.getElementById("course-next-btn");
  const pageSizeSelect = document.getElementById("course-page-size");
  if (summaryEl) summaryEl.textContent = `共 ${total} 门课程`;
  if (pageInfoEl) pageInfoEl.textContent = `第 ${courseCurrentPage} 页 / 共 ${totalPgs} 页`;
  if (prevBtn) prevBtn.disabled = courseCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = courseCurrentPage >= totalPgs || totalPgs <= 1;
  if (pageSizeSelect) pageSizeSelect.value = String(coursePageSize);
}

async function fetchCourses() {
  try {
    const res = await fetch(`${API_BASE}/courses`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取课程列表失败：${res.status}`);
    }

    const data = await res.json();
    allCourses = Array.isArray(data.items) ? data.items : [];
    const totalPgs = getCourseTotalPages();
    if (courseCurrentPage > totalPgs) courseCurrentPage = totalPgs;
    const pageItems = getCoursePageItems();
    renderCourseTable(pageItems);
  } catch (err) {
    console.error(err);
    alert("获取课程列表失败，请确认已登录且为管理员账号。");
  }
}

function renderCourseTable(items) {
  const tbody = document.getElementById("course-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="6" class="py-6 px-4 text-center text-gray-500">
        暂无课程数据，请先新建课程。
      </td>
    `;
    tbody.appendChild(tr);
  } else {
    items.forEach((c) => {
      const tr = document.createElement("tr");
      tr.className = "border-b hover:bg-gray-50";

      tr.innerHTML = `
        <td class="py-4 px-4">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-8 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
              ${
                c.coverUrl
                  ? `<img src="${c.coverUrl}" alt="${c.title || ""}" class="w-full h-full object-cover" />`
                  : "封面"
              }
            </div>
            <div>
              <p class="font-medium text-gray-900">${c.title || ""}</p>
              <p class="text-xs text-gray-500">${c.category || "未分类"}</p>
            </div>
          </div>
        </td>
        <td class="py-4 px-4 text-gray-800 text-sm">${c.category || "-"}</td>
        <td class="py-4 px-4 font-medium text-gray-900">¥${Number(c.price || 0).toFixed(2)}</td>
        <td class="py-4 px-4 text-gray-700 text-sm">${c.videoCount != null ? c.videoCount : 0}</td>
        <td class="py-4 px-4 text-gray-800 text-sm">
          <select
            data-id="${c.id}"
            class="border border-gray-300 rounded-full px-3 py-1 text-xs md:text-sm bg-white js-course-status-select"
          >
            <option value="published" ${c.status === "published" ? "selected" : ""}>上架中</option>
            <option value="free" ${c.status === "free" ? "selected" : ""}>免费</option>
            <option value="archived" ${c.status === "archived" ? "selected" : ""}>已下架</option>
          </select>
        </td>
        <td class="py-4 px-4">
          <div class="flex space-x-3">
            <button
              data-id="${c.id}"
              class="btn-video-action btn-video-edit js-course-edit-btn"
            >
              编辑
            </button>
            <button
              data-id="${c.id}"
              class="btn-video-action btn-video-edit js-course-cover-btn"
            >
              设置封面
            </button>
            <button
              data-id="${c.id}"
              class="btn-video-action btn-video-edit js-course-view-videos-btn"
            >
              查看视频
            </button>
            <button
              data-id="${c.id}"
              class="btn-video-action btn-video-delete js-course-delete-btn"
            >
              删除
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  updateCoursePaginationUI();
}

async function updateCourse(id, origin) {
  const title = prompt("课程名称：", origin.title || "");
  if (!title || !title.trim()) return;

  const category = prompt("课程分类：", origin.category || "") || "";
  const priceStr = prompt(
    "课程价格（元）：",
    origin.price != null ? String(origin.price) : "0"
  );

  const price = priceStr ? Number(priceStr) : 0;

  try {
    const res = await fetch(`${API_BASE}/courses/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: title.trim(),
        category: category.trim() || null,
        price,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `更新失败：${res.status}`);
    }

    alert("课程已更新");
    fetchCourses();
  } catch (err) {
    console.error(err);
    alert("更新课程失败");
  }
}

async function deleteCourse(id) {
  const course = allCourses.find((c) => String(c.id) === String(id));
  const title = course?.title || id;
  const ok = confirm(`你正在删除课程（敏感操作）\n\n课程：${title}\n\n确定继续吗？`);
  if (!ok) return;
  const typed = prompt(`请输入 DELETE 以确认删除课程「${title}」：`, "");
  if (typed !== "DELETE") {
    alert("已取消：未通过二次确认");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `删除失败：${res.status}`);
    }

    alert("课程已删除");
    allCourses = allCourses.filter((c) => String(c.id) !== String(id));
    const totalPgs = getCourseTotalPages();
    if (courseCurrentPage > totalPgs && totalPgs > 0) courseCurrentPage = totalPgs;
    renderCourseTable(getCoursePageItems());
  } catch (err) {
    console.error(err);
    alert("删除课程失败");
  }
}

async function viewCourseVideos(courseId) {
  // 跳转到单独的课程视频管理页，使用查询参数传递课程 ID
  window.location.href = `admin-course-videos.html?courseId=${encodeURIComponent(
    courseId
  )}`;
}

async function updateCourseCover(id) {
  const course = allCourses.find((c) => String(c.id) === String(id));
  const title = course?.title || "";

  // 创建隐形文件选择框
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";

  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("封面图片过大，请控制在 5MB 以内。");
      document.body.removeChild(input);
      return;
    }

    const ok = confirm(
      `你正在为课程设置封面：\n\n课程：${title}\n文件：${file.name}\n\n确定继续吗？`
    );
    if (!ok) {
      document.body.removeChild(input);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getToken();
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/courses/${id}/cover`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `上传封面失败：${res.status}`);
      }

      const data = await res.json();
      alert("封面已更新");

      // 更新本地数据并刷新表格缩略图
      if (course) {
        course.coverUrl = data.coverUrl;
      }
      renderCourseTable(getCoursePageItems());
    } catch (err) {
      console.error(err);
      alert("上传课程封面失败");
    } finally {
      document.body.removeChild(input);
    }
  });

  input.click();
}

async function updateCourseStatus(id, status, selectEl) {
  const course = allCourses.find((c) => String(c.id) === String(id));
  if (!course) return;

  // 敏感：下架给二次确认
  if (status === "archived") {
    const ok = confirm(`你正在修改课程状态（敏感操作）\n\n课程：${course.title}\n新状态：已下架\n\n确定继续吗？`);
    if (!ok) {
      if (selectEl) selectEl.value = course.status || "published";
      return;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: course.title,
        category: course.category,
        price: course.price,
        status,
        description: course.description,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `更新失败：${res.status}`);
    }

    // 同步本地状态，避免刷新整表
    course.status = status;
    alert("课程状态已更新");
  } catch (err) {
    console.error(err);
    alert("更新课程状态失败");
    // 恢复原值
    if (selectEl) {
      selectEl.value = course.status || "published";
    }
  }
}

function bindCourseEvents() {
  const tbody = document.getElementById("course-table-body");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".js-course-delete-btn");
      const editBtn = e.target.closest(".js-course-edit-btn");
      const viewVideosBtn = e.target.closest(".js-course-view-videos-btn");
      const coverBtn = e.target.closest(".js-course-cover-btn");

      if (deleteBtn && deleteBtn.dataset.id) {
        deleteCourse(deleteBtn.dataset.id);
        return;
      }

      if (editBtn && editBtn.dataset.id) {
        const id = editBtn.dataset.id;
        window.location.href = `admin-course-create.html?id=${encodeURIComponent(id)}`;
        return;
      }

      if (viewVideosBtn && viewVideosBtn.dataset.id) {
        viewCourseVideos(viewVideosBtn.dataset.id);
        return;
      }

      if (coverBtn && coverBtn.dataset.id) {
        updateCourseCover(coverBtn.dataset.id);
      }
    });

    tbody.addEventListener("change", (e) => {
      const select = e.target.closest(".js-course-status-select");
      if (select && select.dataset.id) {
        const newStatus = select.value;
        updateCourseStatus(select.dataset.id, newStatus, select);
      }
    });
  }

  const modal = document.getElementById("course-videos-modal");
  const closeBtn = document.getElementById("course-videos-modal-close");
  const backdrop = document.getElementById("course-videos-modal-backdrop");
  const playerEl = document.getElementById("course-videos-player");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      if (playerEl) {
        playerEl.pause();
        playerEl.src = "";
      }
      modal.style.display = "none";
    });
  }

  if (backdrop && modal) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        if (playerEl) {
          playerEl.pause();
          playerEl.src = "";
        }
        modal.style.display = "none";
      }
    });
  }

  const listEl = document.getElementById("course-videos-list");
  // 原弹窗播放逻辑已改为单独页面，这里暂不再绑定事件

  const coursePrevBtn = document.getElementById("course-prev-btn");
  const courseNextBtn = document.getElementById("course-next-btn");
  const coursePageSizeSelect = document.getElementById("course-page-size");
  if (coursePrevBtn) {
    coursePrevBtn.addEventListener("click", () => {
      if (courseCurrentPage > 1) {
        courseCurrentPage--;
        renderCourseTable(getCoursePageItems());
      }
    });
  }
  if (courseNextBtn) {
    courseNextBtn.addEventListener("click", () => {
      const totalPgs = getCourseTotalPages();
      if (courseCurrentPage < totalPgs) {
        courseCurrentPage++;
        renderCourseTable(getCoursePageItems());
      }
    });
  }
  if (coursePageSizeSelect) {
    coursePageSizeSelect.addEventListener("change", (e) => {
      coursePageSize = Math.max(1, parseInt(e.target.value, 10) || 10);
      courseCurrentPage = 1;
      renderCourseTable(getCoursePageItems());
    });
  }
}

function initCourses() {
  bindCourseEvents();
  fetchCourses();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCourses);
} else {
  initCourses();
}

