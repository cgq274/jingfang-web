import { getToken } from "./auth.js";

const API_BASE = "/api";

function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

let currentVideos = [];

async function fetchMemberVideos() {
  try {
    const res = await fetch(`${API_BASE}/member/videos`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取视频列表失败：${res.status}`);
    }

    const data = await res.json();
    currentVideos = Array.isArray(data.items) ? data.items : [];
    renderMemberVideos(currentVideos);
  } catch (err) {
    console.error("加载学员可观看视频失败:", err);
    const container = document.getElementById("member-videos-list");
    if (container) {
      container.innerHTML =
        '<p class="text-sm text-red-500">加载视频失败，请确认已登录。</p>';
    }
  }
}

function renderMemberVideos(items) {
  const container = document.getElementById("member-videos-list");
  const emptyEl = document.getElementById("member-videos-empty");
  if (!container) return;

  container.innerHTML = "";

  if (!items.length) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  // 按课程分组
  const byCourse = new Map();
  for (const v of items) {
    const key = v.course || "未分配课程";
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(v);
  }

  byCourse.forEach((videos, courseTitle) => {
    const section = document.createElement("div");
    section.className = "mb-6";

    section.innerHTML = `
      <h3 class="text-lg font-bold text-gray-900 mb-3">${courseTitle}</h3>
      <div class="space-y-3"></div>
    `;

    const listEl = section.querySelector("div.space-y-3");

    videos.forEach((v) => {
      const item = document.createElement("div");
      item.className =
        "flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 cursor-pointer";
      item.dataset.videoId = v.id;

      const durationText =
        v.durationMinutes != null && v.durationMinutes > 0
          ? `${v.durationMinutes} 分钟`
          : "时长待补充";

      item.innerHTML = `
        <div>
          <p class="font-medium text-gray-900">${v.title || "未命名视频"}</p>
          <p class="text-xs text-gray-500 mt-1">${durationText}</p>
        </div>
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700"
          data-video-id="${v.id}"
        >
          立即播放
        </button>
      `;

      listEl.appendChild(item);
    });

    container.appendChild(section);
  });
}

function openVideoModal(video) {
  const modal = document.getElementById("member-video-modal");
  const titleEl = document.getElementById("member-video-modal-title");
  const videoEl = document.getElementById("member-video-player");

  if (!modal || !titleEl || !videoEl) return;
  if (!video.playUrl) {
    alert("该视频暂时无法播放：缺少播放地址");
    return;
  }

  titleEl.textContent = video.title || "课程视频";
  videoEl.src = video.playUrl;

  modal.style.display = "flex";
}

function closeVideoModal() {
  const modal = document.getElementById("member-video-modal");
  const videoEl = document.getElementById("member-video-player");
  if (!modal || !videoEl) return;

  videoEl.pause();
  videoEl.src = "";
  modal.style.display = "none";
}

function bindMemberVideoEvents() {
  const container = document.getElementById("member-videos-list");
  if (container) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-video-id]");
      if (!btn) return;
      const id = Number(btn.dataset.videoId);
      const video = currentVideos.find((v) => v.id === id);
      if (video) {
        openVideoModal(video);
      }
    });
  }

  document
    .getElementById("member-video-modal-close")
    ?.addEventListener("click", () => closeVideoModal());

  document
    .getElementById("member-video-modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target.id === "member-video-modal-backdrop") {
        closeVideoModal();
      }
    });
}

document.addEventListener("DOMContentLoaded", () => {
  bindMemberVideoEvents();
  fetchMemberVideos();
});

