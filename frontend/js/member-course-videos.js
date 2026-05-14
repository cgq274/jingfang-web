import { getAuthHeaders, saveProgress } from "./api.js";
import { bindCourseVideoPlayerControls } from "./course-video-player.js";

const API_BASE = "/api";

let currentCourseId = null;
let currentPlayingVideo = null;

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}


async function fetchCourseVideos(courseId) {
  const titleEl = document.getElementById("course-videos-title");
  const subtitleEl = document.getElementById("course-videos-subtitle");
  const listEl = document.getElementById("course-videos-list");
  const courseNameEl = document.getElementById("course-name");
  const courseVideoCountEl = document.getElementById("course-video-count");
  const smallCountEl = document.getElementById("course-videos-small-count");
  const coverImgEl = document.getElementById("course-cover-img");
  const coverPlaceholderEl = document.getElementById("course-cover-placeholder");

  if (!courseId) {
    if (subtitleEl) {
      subtitleEl.textContent = "缺少课程参数";
    }
    if (listEl) {
      listEl.innerHTML =
        '<p class="text-xs text-red-500">缺少课程参数，请从会员中心「我的课程」进入。</p>';
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/member/courses/${courseId}/videos`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.message || `加载失败：${res.status}`;
      if (subtitleEl) {
        subtitleEl.textContent = msg;
      }
      if (listEl) {
        listEl.innerHTML = `<p class="text-xs text-red-500">${msg}</p>`;
      }
      if (res.status === 401) {
        setTimeout(() => {
          window.location.replace("index.html");
        }, 1500);
      }
      return;
    }

    const data = await res.json();
    const course = data.course || {};
    const videos = Array.isArray(data.items) ? data.items : [];
    currentCourseId = course.id ? Number(course.id) : null;
    currentVideos = videos;

    if (titleEl) {
      titleEl.textContent = course.title ? `课程视频 - ${course.title}` : "课程视频";
    }
    if (subtitleEl) {
      subtitleEl.textContent = "选择下方视频即可播放观看";
    }
    if (courseNameEl) {
      courseNameEl.textContent = course.title || "-";
    }
    if (courseVideoCountEl) {
      courseVideoCountEl.textContent = String(videos.length);
    }
    if (smallCountEl) {
      smallCountEl.textContent = `共 ${videos.length} 个视频`;
    }

    if (coverImgEl && coverPlaceholderEl) {
      if (course.coverUrl) {
        coverImgEl.src = course.coverUrl;
        coverImgEl.classList.remove("hidden");
        coverPlaceholderEl.classList.add("hidden");
      } else {
        coverImgEl.src = "";
        coverImgEl.classList.add("hidden");
        coverPlaceholderEl.classList.remove("hidden");
      }
    }

    renderVideoList(videos);
  } catch (err) {
    console.error(err);
    if (subtitleEl) {
      subtitleEl.textContent = "加载课程视频失败";
    }
    if (listEl) {
      listEl.innerHTML =
        `<p class="text-xs text-red-500">加载失败：${err.message}</p>`;
    }
  }
}

function renderVideoList(videos) {
  const listEl = document.getElementById("course-videos-list");
  const playerEl = document.getElementById("course-video-player");
  const emptyTipEl = document.getElementById("course-video-empty-tip");
  const currentTitleEl = document.getElementById("course-video-current-title");
  const currentMetaEl = document.getElementById("course-video-current-meta");
  const currentDescEl = document.getElementById("course-video-current-desc");

  if (!listEl) return;

  listEl.innerHTML = "";

  const controlsBar = document.getElementById("video-controls-bar");
  if (!videos.length) {
    listEl.innerHTML =
      '<p class="text-xs text-gray-500 py-2">该课程暂无可观看的视频。</p>';
    if (playerEl) {
      playerEl.src = "";
    }
    if (controlsBar) controlsBar.classList.add("hidden");
    if (emptyTipEl) {
      emptyTipEl.textContent = "该课程暂无可观看的视频";
    }
    if (currentTitleEl) currentTitleEl.textContent = "暂未选择视频";
    if (currentMetaEl) currentMetaEl.textContent = "";
    if (currentDescEl) currentDescEl.textContent = "";
    return;
  }

  if (playerEl) {
    playerEl.src = "";
  }
  if (controlsBar) controlsBar.classList.add("hidden");
  if (emptyTipEl) {
    emptyTipEl.textContent = "从左侧选择一个视频进行播放";
  }
  if (currentTitleEl) currentTitleEl.textContent = "暂未选择视频";
  if (currentMetaEl) currentMetaEl.textContent = "";
  if (currentDescEl) currentDescEl.textContent = "";

  videos.forEach((v) => {
    const item = document.createElement("div");
    item.className =
      "hover-row flex items-center px-3 py-2 gap-3 cursor-pointer js-course-video-item";
    item.dataset.videoId = v.id;

    const durationText =
      v.durationMinutes != null && v.durationMinutes > 0
        ? `${v.durationMinutes} 分钟`
        : "时长待补充";
    const progress = v.progress || {};
    const isCompleted = !!progress.completed;

    item.innerHTML = `
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 ${isCompleted ? "bg-green-100 text-green-600" : "bg-blue-50 text-blue-600"}">
        ${isCompleted ? '<iconify-icon icon="heroicons:check" class="text-lg"></iconify-icon>' : String(v.id).slice(-2).padStart(2, "0")}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-900 text-sm truncate">
          ${escapeHtml(v.title || "未命名视频")}
        </p>
        <p class="text-[11px] text-gray-500 mt-0.5">
          ${durationText}${isCompleted ? " · 已学完" : ""}
        </p>
      </div>
    `;

    listEl.appendChild(item);
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function playVideo(video) {
  const playerEl = document.getElementById("course-video-player");
  const emptyTipEl = document.getElementById("course-video-empty-tip");
  const controlsBar = document.getElementById("video-controls-bar");
  const currentTitleEl = document.getElementById("course-video-current-title");
  const currentMetaEl = document.getElementById("course-video-current-meta");
  const currentDescEl = document.getElementById("course-video-current-desc");

  if (!playerEl) return;
  if (!video.playUrl) {
    alert("该视频暂时无法播放：缺少播放地址");
    return;
  }

  currentPlayingVideo = video;
  playerEl.preload = "metadata";
  playerEl.src = video.playUrl;
  playerEl.load();

  const progressBar = document.getElementById("video-progress");
  const progressFill = document.getElementById("video-progress-fill");
  const progress = video.progress || {};
  const startTime = progress.watchedSeconds > 0 ? Math.max(0, progress.watchedSeconds) : 0;

  function applyStartTime() {
    if (startTime > 0 && Number.isFinite(playerEl.duration) && playerEl.duration > 0) {
      playerEl.currentTime = Math.min(startTime, playerEl.duration - 0.5);
      if (progressBar) {
        progressBar.value = (playerEl.currentTime / playerEl.duration) * 100;
        if (progressFill) progressFill.style.width = `${progressBar.value}%`;
      }
    }
    playerEl.play().catch(() => {});
  }

  if (startTime > 0) {
    playerEl.addEventListener("loadeddata", applyStartTime, { once: true });
  } else {
    if (progressBar) {
      progressBar.value = 0;
      if (progressFill) progressFill.style.width = "0%";
    }
    playerEl.play().catch(() => {});
  }

  if (emptyTipEl) {
    emptyTipEl.textContent = "";
  }
  if (controlsBar) {
    controlsBar.classList.remove("hidden");
  }

  if (currentTitleEl) {
    currentTitleEl.textContent = video.title || "课程视频";
  }

  const durationText =
    video.durationMinutes != null && video.durationMinutes > 0
      ? `${video.durationMinutes} 分钟`
      : "时长待补充";

  if (currentMetaEl) {
    currentMetaEl.textContent = `时长：${durationText}`;
  }

  if (currentDescEl) {
    currentDescEl.textContent = video.description || "";
  }
}

function bindEvents() {
  const listEl = document.getElementById("course-videos-list");
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const row = e.target.closest(".js-course-video-item");
      if (!row || !row.dataset.videoId) return;
      const id = Number(row.dataset.videoId);
      const video = currentVideos.find((v) => v.id === id);
      if (video) {
        playVideo(video);
      }
    });
  }
  bindCourseVideoPlayerControls({
    enableProgressSave: true,
    getCourseId: () => currentCourseId,
    getPlayingVideo: () => currentPlayingVideo,
    saveProgressFn: saveProgress,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  const courseId = getQueryParam("id") || getQueryParam("courseId");
  fetchCourseVideos(courseId);
});
