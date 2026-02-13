import { getToken, logout } from "./auth.js";

const API_BASE = "/api";

function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

let currentVideos = [];

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
      subtitleEl.textContent = "缺少课程 ID 参数";
    }
    if (listEl) {
      listEl.innerHTML =
        '<p class="text-xs text-red-500">缺少课程 ID 参数，无法加载课程视频。</p>';
    }
    return;
  }

  const token = getToken();
  if (!token) {
    if (subtitleEl) {
      subtitleEl.textContent = "未登录或登录已过期，请先登录管理员账号。";
    }
    if (listEl) {
      listEl.innerHTML =
        '<p class="text-xs text-red-500">未登录或登录已过期，请返回后台重新登录。</p>';
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}/videos`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (subtitleEl) {
          subtitleEl.textContent = "无权限访问课程视频，请确认已使用管理员账号登录。";
        }
        if (listEl) {
          listEl.innerHTML =
            '<p class="text-xs text-red-500">权限不足，只有管理员才能访问课程视频列表。</p>';
        }
        return;
      }
      const text = await res.text();
      throw new Error(text || `获取课程视频失败：${res.status}`);
    }

    const data = await res.json();
    const course = data.course || {};
    const videos = Array.isArray(data.items) ? data.items : [];

    currentVideos = videos;

    if (titleEl) {
      titleEl.textContent = course.title
        ? `课程视频管理 - ${course.title}`
        : "课程视频管理";
    }
    if (subtitleEl) {
      subtitleEl.textContent = "在此页面集中查看并预览当前课程下的视频内容。";
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

    // 课程封面展示
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
        `<p class="text-xs text-red-500">加载课程视频失败：${err.message}</p>`;
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

  if (!videos.length) {
    listEl.innerHTML =
      '<p class="text-xs text-gray-500 py-2">该课程暂未关联视频，请在「视频管理」中创建新视频并选择本课程。</p>';
    if (playerEl) {
      playerEl.src = "";
    }
    if (emptyTipEl) {
      emptyTipEl.textContent = "该课程暂未关联视频";
    }
    if (currentTitleEl) currentTitleEl.textContent = "暂未选择视频";
    if (currentMetaEl) currentMetaEl.textContent = "";
    if (currentDescEl) currentDescEl.textContent = "";
    return;
  }

  // 有视频时，不自动播放，保持右侧为“未选择”状态，等待管理员点击
  if (playerEl) {
    playerEl.src = "";
  }
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

    item.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[11px] text-blue-600 flex-shrink-0">
        ${String(v.id).slice(-2).padStart(2, "0")}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-900 text-sm truncate">
          ${v.title || "未命名视频"}
        </p>
        <p class="text-[11px] text-gray-500 mt-0.5">
          ${durationText}
        </p>
      </div>
    `;

    listEl.appendChild(item);
  });
}

function playVideo(video) {
  const playerEl = document.getElementById("course-video-player");
  const emptyTipEl = document.getElementById("course-video-empty-tip");
  const currentTitleEl = document.getElementById("course-video-current-title");
  const currentMetaEl = document.getElementById("course-video-current-meta");
  const currentDescEl = document.getElementById("course-video-current-desc");

  if (!playerEl) return;
  if (!video.playUrl) {
    alert("该视频暂时无法播放：缺少播放地址");
    return;
  }

  playerEl.src = video.playUrl;
  playerEl.play().catch(() => {});

  if (emptyTipEl) {
    emptyTipEl.textContent = "";
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
  const backBtn = document.getElementById("back-to-admin-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "admin.html#courses";
    });
  }

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
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  const courseId = getQueryParam("courseId");
  fetchCourseVideos(courseId);
});

