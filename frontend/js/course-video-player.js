/**
 * 课程页自定义视频控制条（会员端 / 管理端共用 DOM id）
 * @param {Object} opts
 * @param {boolean} [opts.enableProgressSave] 是否向 /api/member/progress 上报进度
 * @param {() => number | null} [opts.getCourseId]
 * @param {() => { id: number } | null} [opts.getPlayingVideo]
 * @param {(courseId: number, videoId: number, currentTime: number, duration: number) => Promise<unknown>} [opts.saveProgressFn]
 */
export function bindCourseVideoPlayerControls(opts = {}) {
  const {
    enableProgressSave = false,
    getCourseId = () => null,
    getPlayingVideo = () => null,
    saveProgressFn = null,
  } = opts;

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

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function showToast(message) {
    const el = document.createElement("div");
    el.className =
      "fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-sm rounded-lg shadow-lg z-[60] max-w-[90vw] text-center";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

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

  if (wrap) {
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("#video-controls-bar")) return;
      togglePlayPause();
    });
  }

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

  const progressFill = document.getElementById("video-progress-fill");
  function updateProgressFill() {
    if (progressBar && progressFill) {
      progressFill.style.width = `${progressBar.value}%`;
    }
  }

  if (progressBar) {
    let lastProgressSave = 0;
    const PROGRESS_SAVE_INTERVAL_MS = 5000;

    function maybeSaveProgress() {
      if (!enableProgressSave || typeof saveProgressFn !== "function") return;
      const courseId = getCourseId();
      const video = getPlayingVideo();
      if (!courseId || !video || !player.duration || !Number.isFinite(player.duration)) return;
      saveProgressFn(courseId, video.id, player.currentTime, player.duration).catch(() => {});
    }

    player.addEventListener("timeupdate", () => {
      if (player.duration && Number.isFinite(player.duration)) {
        progressBar.value = (player.currentTime / player.duration) * 100;
        updateProgressFill();
        if (timeCurrent) {
          timeCurrent.textContent = formatTime(player.currentTime);
        }
        if (enableProgressSave && Date.now() - lastProgressSave >= PROGRESS_SAVE_INTERVAL_MS) {
          lastProgressSave = Date.now();
          maybeSaveProgress();
        }
      }
    });
    player.addEventListener("pause", () => {
      maybeSaveProgress();
    });
    player.addEventListener("ended", () => {
      if (!enableProgressSave || typeof saveProgressFn !== "function") return;
      const courseId = getCourseId();
      const video = getPlayingVideo();
      if (courseId && video && player.duration) {
        saveProgressFn(courseId, video.id, player.duration, player.duration).catch(() => {});
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
    progressBar.addEventListener("input", () => {
      updateProgressFill();
      const pct = Number(progressBar.value) / 100;
      if (player.duration && Number.isFinite(player.duration)) {
        player.currentTime = pct * player.duration;
      }
    });
  }

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

  document.addEventListener("click", () => {
    if (settingsMenu) {
      settingsMenu.classList.add("hidden");
      showSettingsMain();
    }
    if (volumePanel) volumePanel.classList.add("hidden");
  });

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
