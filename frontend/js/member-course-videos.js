import { getAuthHeaders, saveProgress } from "./api.js";

const API_BASE = "/api";

let currentCourseId = null;
let currentPlayingVideo = null;

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-sm rounded-lg shadow-lg z-[60] max-w-[90vw] text-center";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
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
  playerEl.src = video.playUrl;

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

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bindVideoControls() {
  const player = document.getElementById("course-video-player");
  const wrap = document.getElementById("video-player-wrap");
  const playPauseBtn = document.getElementById("video-play-pause");
  const playIcon = document.getElementById("video-play-icon");
  const progressBar = document.getElementById("video-progress");
  const timeCurrent = document.getElementById("video-time-current");
  const timeDuration = document.getElementById("video-time-duration");
  const volumeBtn = document.getElementById("video-volume-btn");
  const volumeIcon = document.getElementById("video-volume-icon");
  const volumeSlider = document.getElementById("video-volume");
  const volumePanel = document.getElementById("video-volume-panel");
  const settingsBtn = document.getElementById("video-settings-btn");
  const settingsMenu = document.getElementById("video-settings-menu");
  const fullscreenBtn = document.getElementById("video-fullscreen-btn");

  if (!player) return;

  function togglePlayPause() {
    if (!player.src) return;
    if (player.ended) {
      player.currentTime = 0;
      player.play().catch(() => {});
    } else if (player.paused) {
      player.play().catch(() => {});
    } else {
      player.pause();
    }
  }

  // 点击屏幕（视频区域）切换播放/暂停，不包含控制条
  if (wrap) {
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("#video-controls-bar")) return;
      togglePlayPause();
    });
  }

  // 播放/暂停按钮
  if (playPauseBtn && playIcon) {
    playPauseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayPause();
    });
  }

  function updatePlayIcon() {
    if (!playIcon) return;
    if (player.paused || player.ended) {
      playIcon.setAttribute("icon", "heroicons:play");
    } else {
      playIcon.setAttribute("icon", "heroicons:pause");
    }
  }

  player.addEventListener("play", updatePlayIcon);
  player.addEventListener("pause", updatePlayIcon);
  player.addEventListener("ended", updatePlayIcon);

  // 进度条：已观看白色，未观看透明轨道
  const progressFill = document.getElementById("video-progress-fill");
  function updateProgressFill() {
    if (progressBar && progressFill) {
      progressFill.style.width = `${progressBar.value}%`;
    }
  }
  if (progressBar) {
    // 学习进度上报：根据真实观看情况更新后端进度与成就
    let lastProgressSave = 0;
    const PROGRESS_SAVE_INTERVAL_MS = 5000;
    function maybeSaveProgress() {
      if (!currentCourseId || !currentPlayingVideo || !player.duration || !Number.isFinite(player.duration)) return;
      saveProgress(currentCourseId, currentPlayingVideo.id, player.currentTime, player.duration).catch(() => {});
    }
    player.addEventListener("timeupdate", () => {
      if (player.duration && Number.isFinite(player.duration)) {
        progressBar.value = (player.currentTime / player.duration) * 100;
        updateProgressFill();
        if (Date.now() - lastProgressSave >= PROGRESS_SAVE_INTERVAL_MS) {
          lastProgressSave = Date.now();
          maybeSaveProgress();
        }
      }
    });
    player.addEventListener("pause", () => {
      maybeSaveProgress();
    });
    player.addEventListener("ended", () => {
      if (currentCourseId && currentPlayingVideo && player.duration) {
        saveProgress(currentCourseId, currentPlayingVideo.id, player.duration, player.duration).catch(() => {});
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) maybeSaveProgress();
    });
    window.addEventListener("pagehide", () => maybeSaveProgress());

    player.addEventListener("loadedmetadata", () => {
      if (timeDuration) {
        timeDuration.textContent = formatTime(player.duration);
      }
    });
    player.addEventListener("timeupdate", () => {
      if (timeCurrent) {
        timeCurrent.textContent = formatTime(player.currentTime);
      }
    });
    progressBar.addEventListener("input", () => {
      updateProgressFill();
      const pct = Number(progressBar.value) / 100;
      if (player.duration && Number.isFinite(player.duration)) {
        player.currentTime = pct * player.duration;
      }
    });
  }

  // 音量：已选音量白色，未选部分透明轨道；点击音量键后显示调节区域
  const volumeFill = document.getElementById("video-volume-fill");
  if (volumeSlider) {
    volumeSlider.value = 100;
    function updateVolumeFill() {
      if (volumeFill) {
        volumeFill.style.width = `${volumeSlider.value}%`;
      }
    }
    volumeSlider.addEventListener("input", (e) => {
      e.stopPropagation();
      player.volume = Number(volumeSlider.value) / 100;
      updateVolumeFill();
      if (volumeIcon) {
        volumeIcon.setAttribute(
          "icon",
          player.volume === 0 ? "heroicons:speaker-x-mark" : "heroicons:speaker-wave"
        );
      }
    });
    updateVolumeFill();
  }
  if (volumeBtn && volumeIcon && volumePanel) {
    volumeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      volumePanel.classList.toggle("hidden");
      if (settingsMenu) settingsMenu.classList.add("hidden");
    });
    volumePanel.addEventListener("click", (e) => e.stopPropagation());
  }

  // 设置菜单：先显示「播放速度」「清晰度」，点击后再展开子菜单
  const settingsMain = document.getElementById("video-settings-main");
  const settingsSpeedPanel = document.getElementById("video-settings-speed-panel");
  const settingsQualityPanel = document.getElementById("video-settings-quality-panel");
  const settingsSpeedEntry = document.getElementById("video-settings-speed-entry");
  const settingsQualityEntry = document.getElementById("video-settings-quality-entry");
  const settingsSpeedBack = document.getElementById("video-settings-speed-back");
  const settingsQualityBack = document.getElementById("video-settings-quality-back");

  function showSettingsMain() {
    if (settingsMain) settingsMain.classList.remove("hidden");
    if (settingsSpeedPanel) settingsSpeedPanel.classList.add("hidden");
    if (settingsQualityPanel) settingsQualityPanel.classList.add("hidden");
  }

  if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle("hidden");
      if (volumePanel) volumePanel.classList.add("hidden");
      showSettingsMain();
    });
    settingsMenu.addEventListener("click", (e) => e.stopPropagation());

    if (settingsSpeedEntry && settingsSpeedPanel && settingsMain) {
      settingsSpeedEntry.addEventListener("click", () => {
        settingsMain.classList.add("hidden");
        settingsSpeedPanel.classList.remove("hidden");
        if (settingsQualityPanel) settingsQualityPanel.classList.add("hidden");
      });
    }
    if (settingsQualityEntry && settingsQualityPanel && settingsMain) {
      settingsQualityEntry.addEventListener("click", () => {
        settingsMain.classList.add("hidden");
        settingsQualityPanel.classList.remove("hidden");
        if (settingsSpeedPanel) settingsSpeedPanel.classList.add("hidden");
      });
    }
    if (settingsSpeedBack) {
      settingsSpeedBack.addEventListener("click", showSettingsMain);
    }
    if (settingsQualityBack) {
      settingsQualityBack.addEventListener("click", showSettingsMain);
    }

    const speedOptions = settingsMenu.querySelectorAll(".video-speed-option");
    speedOptions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = Number(btn.dataset.speed);
        player.playbackRate = speed;
        settingsMenu.classList.add("hidden");
        showSettingsMain();
      });
    });

    const qualityOptions = settingsMenu.querySelectorAll(".video-quality-option");
    qualityOptions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const quality = btn.dataset.quality;
        qualityOptions.forEach((b) => b.classList.remove("bg-blue-600"));
        btn.classList.add("bg-blue-600");
        settingsMenu.classList.add("hidden");
        showSettingsMain();
        showToast(`已切换至 ${quality}（当前视频仅支持单一画质，画质切换将在后续支持多清晰度后生效）`);
      });
    });
  }

  // 点击页面其他区域关闭音量面板和设置菜单，并回到设置主菜单
  document.addEventListener("click", () => {
    if (settingsMenu) {
      settingsMenu.classList.add("hidden");
      if (typeof showSettingsMain === "function") showSettingsMain();
    }
    if (volumePanel) volumePanel.classList.add("hidden");
  });

  // 全屏
  if (fullscreenBtn && wrap) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        wrap.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
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
  bindVideoControls();
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  const courseId = getQueryParam("id") || getQueryParam("courseId");
  fetchCourseVideos(courseId);
});
