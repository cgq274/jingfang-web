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

let currentVideos = [];
let currentPage = 1;
let pageSize = 10;

function getTotalPages() {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(currentVideos.length / pageSize));
}

function getPageItems() {
  const total = currentVideos.length;
  if (total === 0) return [];
  const totalPgs = getTotalPages();
  const page = Math.min(currentPage, totalPgs);
  const start = (page - 1) * pageSize;
  return currentVideos.slice(start, start + pageSize);
}

function updatePaginationUI() {
  const total = currentVideos.length;
  const totalPgs = getTotalPages();
  const summaryEl = document.getElementById("video-table-summary");
  const pageInfoEl = document.getElementById("video-page-info");
  const prevBtn = document.getElementById("video-prev-btn");
  const nextBtn = document.getElementById("video-next-btn");
  const pageSizeSelect = document.getElementById("video-page-size");

  if (summaryEl) {
    summaryEl.textContent = `共 ${total} 条视频`;
  }
  if (pageInfoEl) {
    pageInfoEl.textContent = `第 ${currentPage} 页 / 共 ${totalPgs} 页`;
  }
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPgs || totalPgs <= 1;
  }
  if (pageSizeSelect) {
    pageSizeSelect.value = String(pageSize);
  }
}

function renderVideoTable(items) {
  const tbody = document.getElementById("video-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="6" class="py-6 px-4 text-center text-gray-500">
        暂无视频，请前往「视频上传」添加。
      </td>
    `;
    tbody.appendChild(tr);
  } else {
    items.forEach((v) => {
      const tr = document.createElement("tr");
      tr.className = "border-b hover:bg-gray-50";

      const statusInfo =
        v.status === "published"
          ? { text: "已发布", cls: "bg-green-100 text-green-700" }
          : v.status === "review"
          ? { text: "审核中", cls: "bg-yellow-100 text-yellow-700" }
          : { text: "草稿", cls: "bg-gray-100 text-gray-700" };

      tr.innerHTML = `
        <td class="py-4 px-4">
          <div class="flex items-center space-x-3">
            <div class="w-16 h-12 rounded overflow-hidden bg-gray-200 flex items-center justify-center text-xs text-gray-500">
              封面
            </div>
            <div>
              <p class="font-medium text-gray-900">${v.title || ""}</p>
              <p class="text-sm text-gray-600">${v.createdAt || ""}</p>
            </div>
          </div>
        </td>
        <td class="py-4 px-4 text-gray-800 text-sm">
          ${v.course || "-"}
        </td>
        <td class="py-4 px-4 font-medium text-gray-900">¥${Number(
          v.price || 0
        ).toFixed(2)}</td>
        <td class="py-4 px-4 text-gray-700">${v.durationMinutes || 0} 分钟</td>
        <td class="py-4 px-4 text-gray-800 text-sm">
          ${statusInfo.text}
        </td>
        <td class="py-4 px-4">
          <div class="flex space-x-3">
            <button
              data-id="${v.id}"
              class="btn-video-action btn-video-edit js-video-edit-btn"
            >
              编辑
            </button>
            <button
              data-id="${v.id}"
              class="btn-video-action btn-video-delete js-video-delete-btn"
            >
              删除
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  updatePaginationUI();
}

async function fetchVideos() {
  try {
    const res = await fetch(`${API_BASE}/videos`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取视频列表失败：${res.status}`);
    }

    const data = await res.json();
    currentVideos = Array.isArray(data.items) ? data.items : [];
    const totalPgs = getTotalPages();
    if (currentPage > totalPgs) {
      currentPage = totalPgs;
    }
    const pageItems = getPageItems();
    renderVideoTable(pageItems);
  } catch (err) {
    console.error(err);
    alert("获取视频列表失败，请确认已登录且为管理员账号。");
  }
}

async function handleDeleteVideo(id) {
  const video = currentVideos.find((v) => String(v.id) === String(id));
  const title = video?.title || id;
  const ok = confirm(`你正在删除视频（敏感操作）\n\n视频：${title}\n\n确定继续吗？`);
  if (!ok) return;
  const typed = prompt(`请输入 DELETE 以确认删除视频「${title}」：`, "");
  if (typed !== "DELETE") {
    alert("已取消：未通过二次确认");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/videos/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `删除失败：${res.status}`);
    }

    alert("视频已删除");
    currentVideos = currentVideos.filter((v) => String(v.id) !== String(id));
    const totalPgs = getTotalPages();
    if (currentPage > totalPgs && totalPgs > 0) {
      currentPage = totalPgs;
    }
    const pageItems = getPageItems();
    renderVideoTable(pageItems);
  } catch (err) {
    console.error(err);
    alert("删除视频失败");
  }
}

function bindEvents() {
  const tbody = document.getElementById("video-table-body");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".js-video-delete-btn");
      const editBtn = e.target.closest(".js-video-edit-btn");

      if (deleteBtn && deleteBtn.dataset.id) {
        handleDeleteVideo(deleteBtn.dataset.id);
        return;
      }

      if (editBtn && editBtn.dataset.id) {
        const id = editBtn.dataset.id;
        window.location.href = `admin-video-upload.html?id=${encodeURIComponent(id)}`;
      }
    });
  }

  const prevBtn = document.getElementById("video-prev-btn");
  const nextBtn = document.getElementById("video-next-btn");
  const pageSizeSelect = document.getElementById("video-page-size");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderVideoTable(getPageItems());
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const totalPgs = getTotalPages();
      if (currentPage < totalPgs) {
        currentPage++;
        renderVideoTable(getPageItems());
      }
    });
  }
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = Math.max(1, parseInt(e.target.value, 10) || 10);
      currentPage = 1;
      renderVideoTable(getPageItems());
    });
  }
}

function init() {
  bindEvents();
  fetchVideos();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
