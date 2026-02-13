import { getMemberStats } from "./api.js";

const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 45;

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function applyStats(data) {
  const percentEl = document.getElementById("member-progress-percent");
  const ringEl = document.getElementById("member-progress-ring-circle");
  const lessonsEl = document.getElementById("member-progress-lessons");
  const hoursEl = document.getElementById("member-stat-hours");
  const hoursBarEl = document.getElementById("member-stat-hours-bar");
  const daysEl = document.getElementById("member-stat-days");
  const daysBarEl = document.getElementById("member-stat-days-bar");
  const rateEl = document.getElementById("member-stat-rate");
  const rateBarEl = document.getElementById("member-stat-rate-bar");
  const achievementsListEl = document.getElementById("member-achievements-list");

  const percent = data.overallProgressPercent != null ? data.overallProgressPercent : 0;
  const completed = data.completedVideos != null ? data.completedVideos : 0;
  const total = data.totalVideos != null ? data.totalVideos : 0;

  if (percentEl) percentEl.textContent = `${percent}%`;
  if (ringEl) {
    const offset = PROGRESS_RING_CIRCUMFERENCE - (percent / 100) * PROGRESS_RING_CIRCUMFERENCE;
    ringEl.style.strokeDasharray = PROGRESS_RING_CIRCUMFERENCE;
    ringEl.style.strokeDashoffset = Math.max(0, offset);
  }
  if (lessonsEl) lessonsEl.textContent = `已学习 ${completed}/${total} 课时`;

  const hours = data.watchHoursThisWeek != null ? data.watchHoursThisWeek : 0;
  const days = data.consecutiveDays != null ? data.consecutiveDays : 0;
  const rate = data.courseCompletionRate != null ? data.courseCompletionRate : 0;

  if (hoursEl) hoursEl.textContent = `${hours} 小时`;
  if (hoursBarEl) hoursBarEl.style.width = `${Math.min(100, (hours / 10) * 100)}%`;
  if (daysEl) daysEl.textContent = `${days} 天`;
  if (daysBarEl) daysBarEl.style.width = `${Math.min(100, (days / 7) * 100)}%`;
  if (rateEl) rateEl.textContent = `${rate}%`;
  if (rateBarEl) rateBarEl.style.width = `${rate}%`;

  if (achievementsListEl) {
    const achievements = Array.isArray(data.achievements) ? data.achievements : [];
    if (achievements.length === 0) {
      achievementsListEl.innerHTML = "<p class=\"text-gray-500 text-sm\">暂无成就，完成课程学习后解锁</p>";
    } else {
      achievementsListEl.innerHTML = `
        <ul class="space-y-2">
          ${achievements.map((a) => `
            <li class="flex items-center gap-2 text-sm text-gray-700">
              <iconify-icon icon="heroicons:academic-cap" class="text-amber-500 text-lg flex-shrink-0"></iconify-icon>
              <span>${escapeHtml(a.label || a.title || "完成课程")}</span>
            </li>
          `).join("")}
        </ul>
      `;
    }
  }
}

export async function loadMemberStats() {
  try {
    const data = await getMemberStats();
    applyStats(data);
  } catch (err) {
    console.error("加载学习统计失败:", err);
  }
}

const progressCard = document.getElementById("member-learning-progress-card");
if (progressCard) {
  loadMemberStats();
}
