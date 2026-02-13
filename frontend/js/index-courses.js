const API_BASE = "/api";

function createIndexCourseCard(course, index) {
  const card = document.createElement("div");
  card.className = "bg-white rounded-2xl overflow-hidden shadow-soft hover-lift";

  const coverUrl =
    course.coverUrl ||
    `https://picsum.photos/600/400?random=${index + 1}`;

  // 根据索引决定标签和颜色
  let badgeText = "热门";
  let badgeColor = "bg-blue-600";
  let categoryColor = "text-blue-600";
  
  if (index === 1) {
    badgeText = "新课程";
    badgeColor = "bg-green-600";
    categoryColor = "text-green-600";
  } else if (index === 2) {
    badgeText = "前沿";
    badgeColor = "bg-purple-600";
    categoryColor = "text-purple-600";
  }

  card.innerHTML = `
    <div class="relative h-48 overflow-hidden">
      <img src="${coverUrl}" alt="${course.title || ""}" class="w-full h-full object-cover">
      <div class="absolute top-4 left-4">
        <span class="px-3 py-1 ${badgeColor} text-white text-sm font-medium rounded-full">${badgeText}</span>
      </div>
    </div>
    <div class="p-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium ${categoryColor}">${course.category || "金融课程"}</span>
        <div class="flex items-center text-amber-500">
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <span class="ml-1 font-medium">4.9</span>
        </div>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-3">${course.title || "金融课程"}</h3>
      <p class="text-gray-600 mb-4">${course.description || "适合希望系统提升金融实战能力的学员。"}</p>
      <div class="flex items-center justify-between">
        <div class="flex items-center text-gray-500">
          <iconify-icon icon="heroicons:clock" class="mr-1"></iconify-icon>
          <span class="text-sm">${course.videoCount || 0}课时</span>
        </div>
        <div class="text-lg font-bold text-gray-900">¥${Number(course.price || 0).toFixed(2)}</div>
      </div>
    </div>
  `;

  // 添加点击事件，跳转到课程详情或课程中心
  card.style.cursor = "pointer";
  card.addEventListener("click", () => {
    window.location.href = `courses.html`;
  });

  return card;
}

async function loadIndexCourses() {
  try {
    const grid = document.getElementById("index-courses-grid");
    if (!grid) return;

    const res = await fetch(`${API_BASE}/public/courses`);
    if (!res.ok) {
      throw new Error(`加载课程失败：${res.status}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // 清空容器
    grid.innerHTML = "";

    // 只显示前3个课程
    const featured = items.slice(0, 3);
    
    if (featured.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-500">
          <p>暂无课程数据</p>
        </div>
      `;
      return;
    }

    featured.forEach((course, index) => {
      grid.appendChild(createIndexCourseCard(course, index));
    });
  } catch (err) {
    console.error("加载首页课程失败:", err);
    const grid = document.getElementById("index-courses-grid");
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-500">
          <p>加载课程失败，请稍后重试</p>
        </div>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadIndexCourses();
});
