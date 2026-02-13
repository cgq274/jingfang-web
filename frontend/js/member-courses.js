import { getMyCourses } from "./api.js";

const container = document.getElementById("member-my-courses");
if (!container) throw new Error("未找到 #member-my-courses");

async function loadMyCourses() {
  try {
    const data = await getMyCourses();
    const items = Array.isArray(data.items) ? data.items : [];

    if (items.length === 0) {
      container.innerHTML = `
        <iconify-icon icon="heroicons:academic-cap" class="text-5xl text-gray-300 mb-4"></iconify-icon>
        <p class="text-gray-500 mb-4">暂无已购课程</p>
        <a href="courses.html" class="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">去课程中心选课</a>
      `;
      return;
    }

    const cards = items
      .map((c) => {
        const videoCount = c.videoCount != null ? c.videoCount : 0;
        const completedCount = c.completedCount != null ? c.completedCount : 0;
        const progressPercent = c.progressPercent != null ? c.progressPercent : 0;
        const isCompleted = !!c.completed;
        return `
        <a href="member-course-videos.html?id=${encodeURIComponent(c.id)}" class="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all duration-200">
          <div class="aspect-video bg-gray-100 flex items-center justify-center relative">
            ${c.coverUrl ? `<img src="${escapeAttr(c.coverUrl)}" alt="${escapeAttr(c.title)}" class="w-full h-full object-cover">` : `<iconify-icon icon="heroicons:academic-cap" class="text-4xl text-gray-400"></iconify-icon>`}
            ${videoCount > 0 ? `<div class="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200/80"><div class="h-full bg-blue-500 transition-all" style="width: ${progressPercent}%"></div></div>` : ""}
          </div>
          <div class="p-4">
            <h3 class="font-bold text-gray-900 mb-1">${escapeHtml(c.title || "课程")}</h3>
            <p class="text-sm text-gray-500">${c.source === "free" ? "免费加入" : "已购买"} · ${videoCount} 课时</p>
            <p class="text-xs text-blue-600 mt-1">学习进度：已学 ${completedCount}/${videoCount} 课时 ${isCompleted ? "· 已完成" : ""}</p>
          </div>
        </a>
      `;
      })
      .join("");

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
        ${cards}
      </div>
    `;
  } catch (err) {
    console.error("加载我的课程失败:", err);
    container.innerHTML = `
      <p class="text-red-500 mb-4">加载失败，请刷新重试。</p>
      <a href="courses.html" class="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">去课程中心选课</a>
    `;
  }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

loadMyCourses();
