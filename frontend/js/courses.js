import { getToken } from "./auth.js";
import {
  getMyCourses,
  enrollCourse,
  createOrder,
  getOrder,
  confirmMockPay,
  getPaymentStatus,
  createWechatPay,
  createAlipayPay,
} from "./api.js";

const API_BASE = "/api";

/** 当前用户已拥有的课程 ID 集合（登录后加载） */
let ownedCourseIds = new Set();

function mapCategoryTag(category) {
  if (!category) return "other";
  if (category.includes("投")) return "investment";
  if (category.includes("险")) return "risk";
  if (category.includes("科") || category.toLowerCase().includes("tech")) return "fintech";
  return "other";
}

function getCourseActionButton(course, ownedSet) {
  const id = course.id;
  const isFree = course.status === "free" || (Number(course.price) || 0) <= 0;
  const owned = ownedSet && ownedSet.has(id);
  if (owned) {
    return `<button type="button" class="flex-1 px-4 py-3 bg-gray-200 text-gray-600 font-medium rounded-lg cursor-default" disabled>${isFree ? "已加入" : "已购买"}</button>`;
  }
  if (isFree) {
    return `<button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 js-course-join" data-course-id="${id}">加入</button>`;
  }
  return `<button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-300 js-course-buy" data-course-id="${id}">购买</button>`;
}

function createFeaturedCard(course, index, ownedSet) {
  const card = document.createElement("div");
  card.className =
    "course-card-hover bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100";
  const categoryTag = mapCategoryTag(course.category || "");
  const isFree = course.status === "free";
  const owned = ownedSet && ownedSet.has(course.id);

  card.dataset.category = categoryTag;
  card.dataset.status = course.status || "published";
  card.dataset.courseId = course.id;
  if (owned) card.dataset.owned = "1";

  const coverUrl =
    course.coverUrl ||
    `https://picsum.photos/600/400?random=${21 + (index % 10)}`;

  const actionBtn = getCourseActionButton(course, ownedSet);

  card.innerHTML = `
    <div class="relative">
      <img src="${coverUrl}" alt="${course.title || ""}" class="w-full h-48 object-cover">
      <div class="absolute top-4 left-4">
        <span class="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">${
          index === 0 ? "热销中" : index === 1 ? "新课上线" : "精选课程"
        }</span>
      </div>
      <div class="absolute top-4 right-4">
        <span class="px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded-full">${
          course.category || "金融课程"
        }</span>
        ${isFree ? '<span class="ml-1 px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">免费</span>' : ""}
      </div>
    </div>
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center text-amber-500 text-sm">
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <iconify-icon icon="heroicons:star" class="text-lg"></iconify-icon>
          <span class="ml-2 text-gray-700 font-medium">课程好评</span>
        </div>
        <span class="text-2xl font-bold text-gray-900">${isFree ? "免费" : "¥" + Number(course.price || 0).toFixed(2)}</span>
      </div>
      
      <h3 class="text-xl font-bold text-gray-900 mb-3">${
        course.title || "金融课程"
      }</h3>
      <p class="text-gray-600 mb-6 text-sm">${
        course.description || "适合希望系统提升金融实战能力的学员。"
      }</p>
      
      <div class="flex items-center justify-between text-sm text-gray-500 mb-6">
        <div class="flex items-center">
          <iconify-icon icon="heroicons:clock" class="mr-1"></iconify-icon>
          <span>${course.videoCount != null ? course.videoCount : 0}课时</span>
        </div>
        <div class="flex items-center">
          <iconify-icon icon="heroicons:user" class="mr-1"></iconify-icon>
          <span>在线课程</span>
        </div>
        <div class="flex items-center">
          <iconify-icon icon="heroicons:calendar" class="mr-1"></iconify-icon>
          <span>随时报名</span>
        </div>
      </div>
      
      <div class="flex space-x-3">
        <a href="member.html" class="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 text-center">
          查看课程
        </a>
        ${actionBtn}
      </div>
    </div>
  `;

  return card;
}

function createAllCourseCard(course, index, ownedSet) {
  const card = document.createElement("div");
  card.className =
    "bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow duration-300";
  const isFree = course.status === "free";
  const owned = ownedSet && ownedSet.has(course.id);
  card.dataset.status = course.status || "published";
  card.dataset.courseId = course.id;
  if (owned) card.dataset.owned = "1";

  const actionBtn = getCourseActionButton(course, ownedSet);

  const iconClasses = [
    "heroicons:chart-bar text-blue-600 bg-blue-100",
    "heroicons:shield-check text-green-600 bg-green-100",
    "heroicons:cpu-chip text-purple-600 bg-purple-100",
    "heroicons:banknotes text-amber-600 bg-amber-100",
  ];
  const icon = iconClasses[index % iconClasses.length];
  const [iconName, bgClass] = icon.split(" ");

  const desc = course.description
    ? course.description.slice(0, 40) + (course.description.length > 40 ? "..." : "")
    : "系统化的课程体系，帮助您打牢金融基础，提升实战能力。";
  const videoCount = course.videoCount != null ? course.videoCount : 0;

  card.innerHTML = `
    <div class="w-12 h-12 rounded-lg ${bgClass} flex items-center justify-center mb-4">
      <iconify-icon icon="${iconName}" class="text-2xl"></iconify-icon>
    </div>
    <h3 class="text-lg font-bold text-gray-900 mb-2">${course.title || "金融课程"}</h3>
    <p class="text-gray-600 text-sm mb-4">${desc}</p>
    <div class="flex items-center justify-between mb-3">
      ${isFree ? '<span class="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">免费课程</span>' : '<span class="text-xl font-bold text-gray-900">¥' + Number(course.price || 0).toFixed(2) + '</span>'}
      <span class="text-sm text-gray-500">${videoCount}课时</span>
    </div>
    <div class="mt-3">${actionBtn}</div>
  `;

  return card;
}

function initFilters() {
  const filterButtons = document.querySelectorAll(".course-filter-btn");
  const featuredGrid = document.getElementById("courses-featured-grid");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => {
        btn.classList.remove(
          "active",
          "bg-gradient-to-r",
          "from-blue-600",
          "to-indigo-600",
          "text-white",
          "shadow-md"
        );
        btn.classList.add("bg-gray-100", "text-gray-700", "hover:bg-gray-200");
      });

      button.classList.add(
        "active",
        "bg-gradient-to-r",
        "from-blue-600",
        "to-indigo-600",
        "text-white",
        "shadow-md"
      );
      button.classList.remove("bg-gray-100", "text-gray-700", "hover:bg-gray-200");

      const filter = button.getAttribute("data-filter");
      if (!featuredGrid) return;

      const cards = featuredGrid.querySelectorAll(".course-card-hover");
      cards.forEach((card) => {
        const cat = card.dataset.category || "other";
        const status = card.dataset.status || "published";
        const owned = card.dataset.owned === "1";
        if (filter === "all") {
          card.style.display = "";
        } else if (filter === "my-courses") {
          card.style.display = owned ? "" : "none";
        } else if (filter === "free") {
          card.style.display = status === "free" ? "" : "none";
        } else {
          card.style.display = cat === filter ? "" : "none";
        }
      });

      const allGrid = document.getElementById("courses-all-grid");
      if (allGrid) {
        const allCards = allGrid.querySelectorAll("[data-status]");
        allCards.forEach((card) => {
          const status = card.dataset.status || "published";
          const owned = card.dataset.owned === "1";
          if (filter === "all") {
            card.style.display = "";
          } else if (filter === "my-courses") {
            card.style.display = owned ? "" : "none";
          } else if (filter === "free") {
            card.style.display = status === "free" ? "" : "none";
          } else {
            card.style.display = "";
          }
        });
      }
    });
  });
}

function initHoverEffects() {
  const grid = document.getElementById("courses-featured-grid");
  if (!grid) return;

  grid.addEventListener("mouseenter", (e) => {
    const card = e.target.closest(".course-card-hover");
    if (!card) return;
    card.style.transform = "translateY(-8px) scale(1.02)";
    card.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
  }, true);

  grid.addEventListener("mouseleave", (e) => {
    const card = e.target.closest(".course-card-hover");
    if (!card) return;
    card.style.transform = "translateY(0) scale(1)";
    card.style.boxShadow = "";
  }, true);
}

function initViewAllButton() {
  const btn = document.querySelector("#courses-featured-root a[href='#']");
  const allSection = document.getElementById("courses-all-root");
  if (btn && allSection) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      allSection.scrollIntoView({ behavior: "smooth" });
    });
  }
}

const ALL_PAGE_SIZE = 8;
let allCoursesList = [];
let allCoursesShown = 0;

function renderAllBatch() {
  const allGrid = document.getElementById("courses-all-grid");
  const loadMoreBtn = document.getElementById("load-more-courses-btn");
  const loadMoreWrapper = document.getElementById("load-more-wrapper");
  if (!allGrid) return;

  const start = allCoursesShown;
  const end = Math.min(start + ALL_PAGE_SIZE, allCoursesList.length);
  for (let i = start; i < end; i++) {
    allGrid.appendChild(createAllCourseCard(allCoursesList[i], i, ownedCourseIds));
  }
  allCoursesShown = end;

  if (loadMoreBtn && loadMoreWrapper) {
    if (allCoursesList.length === 0) {
      loadMoreWrapper.style.display = "none";
    } else if (allCoursesShown >= allCoursesList.length) {
      loadMoreBtn.textContent = "已加载全部课程";
      loadMoreBtn.disabled = true;
      loadMoreBtn.classList.remove(
        "from-blue-600", "to-indigo-600", "hover:from-blue-700", "hover:to-indigo-700"
      );
      loadMoreBtn.classList.add("bg-gray-300", "text-gray-700", "cursor-not-allowed");
    } else {
      loadMoreBtn.textContent = `加载更多课程（${allCoursesShown}/${allCoursesList.length}）`;
    }
  }
}

function initLoadMoreButton() {
  const loadMoreBtn = document.getElementById("load-more-courses-btn");
  if (!loadMoreBtn) return;
  loadMoreBtn.addEventListener("click", () => {
    if (loadMoreBtn.disabled) return;
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML =
      '<span class="flex items-center justify-center"><iconify-icon icon="heroicons:arrow-path" class="animate-spin mr-2 text-xl"></iconify-icon>加载中...</span>';
    setTimeout(() => {
      renderAllBatch();
      loadMoreBtn.disabled = allCoursesShown >= allCoursesList.length;
      loadMoreBtn.textContent =
        allCoursesShown >= allCoursesList.length
          ? "已加载全部课程"
          : `加载更多课程（${allCoursesShown}/${allCoursesList.length}）`;
      if (loadMoreBtn.disabled) {
        loadMoreBtn.classList.remove(
          "from-blue-600", "to-indigo-600", "hover:from-blue-700", "hover:to-indigo-700"
        );
        loadMoreBtn.classList.add("bg-gray-300", "text-gray-700", "cursor-not-allowed");
      }
    }, 300);
  });
}

function openLoginModal() {
  const backdrop = document.getElementById("login-modal-backdrop");
  if (backdrop) {
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

let currentPayOrderId = null;
let currentPayCourseId = null;

function openPayModal(course) {
  currentPayCourseId = course.id;
  const backdrop = document.getElementById("pay-modal-backdrop");
  const courseEl = document.getElementById("pay-modal-course");
  const amountEl = document.getElementById("pay-modal-amount");
  const msgEl = document.getElementById("pay-modal-message");
  const qrWrap = document.getElementById("pay-wechat-qr-wrap");
  const qrCanvas = document.getElementById("pay-wechat-qr-canvas");
  if (backdrop && courseEl && amountEl) {
    courseEl.textContent = course.title || "课程";
    amountEl.textContent = "¥" + Number(course.price || 0).toFixed(2);
    if (msgEl) msgEl.classList.add("hidden");
    if (qrWrap) qrWrap.classList.add("hidden");
    if (qrCanvas) qrCanvas.innerHTML = "";
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closePayModal() {
  if (payPollTimer) { clearInterval(payPollTimer); payPollTimer = null; }
  const backdrop = document.getElementById("pay-modal-backdrop");
  if (backdrop) {
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }
  currentPayOrderId = null;
  currentPayCourseId = null;
}

function initPayModal() {
  const closeBtn = document.getElementById("pay-modal-close");
  const backdrop = document.getElementById("pay-modal-backdrop");
  const wechatBtn = document.getElementById("pay-method-wechat");
  const alipayBtn = document.getElementById("pay-method-alipay");
  const mockBtn = document.getElementById("pay-method-mock");
  const msgEl = document.getElementById("pay-modal-message");
  const qrWrap = document.getElementById("pay-wechat-qr-wrap");
  const qrCanvas = document.getElementById("pay-wechat-qr-canvas");

  if (closeBtn) closeBtn.addEventListener("click", closePayModal);
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closePayModal(); });

  if (wechatBtn) {
    wechatBtn.addEventListener("click", async () => {
      if (!currentPayOrderId) {
        if (msgEl) { msgEl.textContent = "请稍候，正在创建订单…"; msgEl.classList.remove("hidden"); }
        return;
      }
      if (msgEl) { msgEl.textContent = "正在生成微信支付二维码…"; msgEl.classList.remove("hidden"); msgEl.classList.remove("text-red-500"); msgEl.classList.add("text-gray-600"); }
      try {
        const data = await createWechatPay(currentPayOrderId);
        if (msgEl) msgEl.classList.add("hidden");
        if (qrWrap && qrCanvas && data.codeUrl) {
          qrCanvas.innerHTML = "";
          if (typeof window.QRCode !== "undefined") {
            const canvas = document.createElement("canvas");
            window.QRCode.toCanvas(canvas, data.codeUrl, { width: 200, margin: 1 }, (err) => {
              if (!err && canvas) qrCanvas.appendChild(canvas);
            });
          } else {
            const a = document.createElement("p");
            a.className = "text-xs text-gray-500 break-all";
            a.textContent = data.codeUrl;
            qrCanvas.appendChild(a);
          }
          qrWrap.classList.remove("hidden");
        }
        startPayPolling(currentPayOrderId);
      } catch (e) {
        if (e.needReLogin) {
          closePayModal();
          openLoginModal();
          alert("登录已过期，请重新登录");
        } else if (msgEl) {
          msgEl.textContent = e.message || "微信下单失败";
          msgEl.classList.remove("text-gray-600");
          msgEl.classList.add("text-red-500");
        }
      }
    });
  }

  if (alipayBtn) {
    alipayBtn.addEventListener("click", async () => {
      if (!currentPayOrderId) {
        if (msgEl) { msgEl.textContent = "请稍候，正在创建订单…"; msgEl.classList.remove("hidden"); }
        return;
      }
      if (msgEl) { msgEl.textContent = "正在跳转支付宝…"; msgEl.classList.remove("hidden"); }
      try {
        const data = await createAlipayPay(currentPayOrderId);
        if (data.payUrl) window.location.href = data.payUrl;
        else if (msgEl) msgEl.textContent = "未获取到支付链接";
      } catch (e) {
        if (e.needReLogin) {
          closePayModal();
          openLoginModal();
          alert("登录已过期，请重新登录");
        } else if (msgEl) {
          msgEl.textContent = e.message || "支付宝下单失败";
          msgEl.classList.remove("hidden");
        }
      }
    });
  }

  if (mockBtn) {
    mockBtn.addEventListener("click", async () => {
      if (!currentPayOrderId) {
        if (msgEl) { msgEl.textContent = "请稍候，正在创建订单…"; msgEl.classList.remove("hidden"); }
        return;
      }
      if (msgEl) msgEl.textContent = "支付处理中…";
      msgEl.classList.remove("hidden");
      try {
        await confirmMockPay(currentPayOrderId);
        if (msgEl) msgEl.textContent = "";
        closePayModal();
        ownedCourseIds.add(currentPayCourseId);
        updateCourseCardButton(currentPayCourseId, false);
        alert("支付成功！课程已加入学习中心，可前往「会员中心」观看视频。");
      } catch (e) {
        if (e.needReLogin) {
          closePayModal();
          openLoginModal();
          alert("登录已过期，请重新登录");
        } else if (msgEl) {
          msgEl.textContent = e.message || "支付失败";
        }
      }
    });
  }
}

let payPollTimer = null;
function startPayPolling(orderId) {
  if (payPollTimer) clearInterval(payPollTimer);
  payPollTimer = setInterval(async () => {
    if (!currentPayOrderId) { clearInterval(payPollTimer); payPollTimer = null; return; }
    try {
      const order = await getOrder(orderId);
      if (order.status === "paid") {
        if (payPollTimer) { clearInterval(payPollTimer); payPollTimer = null; }
        closePayModal();
        ownedCourseIds.add(currentPayCourseId);
        updateCourseCardButton(currentPayCourseId, false);
        alert("支付成功！课程已加入学习中心，可前往「会员中心」观看视频。");
      }
    } catch (_) {}
  }, 2500);
}

function updateCourseCardButton(courseId, isFree) {
  const id = String(courseId);
  document.querySelectorAll(`[data-course-id="${id}"]`).forEach((btn) => {
    if (btn.tagName !== "BUTTON" || !btn.classList.contains("js-course-join") && !btn.classList.contains("js-course-buy")) return;
    btn.outerHTML = `<button type="button" class="flex-1 px-4 py-3 bg-gray-200 text-gray-600 font-medium rounded-lg cursor-default" disabled>${isFree ? "已加入" : "已购买"}</button>`;
  });
  document.querySelectorAll(`.course-card-hover[data-course-id="${id}"], [data-course-id="${id}"][data-status]`).forEach((card) => {
    card.dataset.owned = "1";
  });
}

function initCourseActions() {
  document.addEventListener("click", async (e) => {
    const joinBtn = e.target.closest(".js-course-join");
    const buyBtn = e.target.closest(".js-course-buy");
    if (joinBtn && joinBtn.dataset.courseId) {
      e.preventDefault();
      const courseId = joinBtn.dataset.courseId;
      if (!getToken()) {
        openLoginModal();
        return;
      }
      joinBtn.disabled = true;
      joinBtn.textContent = "加入中…";
      try {
        await enrollCourse(courseId);
        ownedCourseIds.add(Number(courseId));
        updateCourseCardButton(courseId, true);
        alert("加入成功！可前往「会员中心」学习。");
      } catch (err) {
        joinBtn.disabled = false;
        joinBtn.textContent = "加入";
        alert(err.message || "加入失败");
      }
      return;
    }
    if (buyBtn && buyBtn.dataset.courseId) {
      e.preventDefault();
      const courseId = buyBtn.dataset.courseId;
      if (!getToken()) {
        openLoginModal();
        return;
      }
      buyBtn.disabled = true;
      buyBtn.textContent = "处理中…";
      try {
        const order = await createOrder(courseId);
        currentPayOrderId = order.orderId;
        currentPayCourseId = order.courseId;
        const course = allCoursesList.find((c) => String(c.id) === String(courseId)) || { title: order.title, price: order.amount };
        openPayModal(course);
      } catch (err) {
        if (err.needReLogin) {
          openLoginModal();
          alert("登录已过期，请重新登录");
        } else {
          alert(err.message || "创建订单失败");
        }
      }
      buyBtn.disabled = false;
      buyBtn.textContent = "购买";
    }
  });
}

async function loadCourses() {
  try {
    if (getToken()) {
      try {
        const data = await getMyCourses();
        const items = Array.isArray(data.items) ? data.items : [];
        ownedCourseIds = new Set(items.map((c) => c.id));
      } catch (_) {
        ownedCourseIds = new Set();
      }
    } else {
      ownedCourseIds = new Set();
    }

    const res = await fetch(`${API_BASE}/public/courses`);
    if (!res.ok) {
      throw new Error(`加载课程失败：${res.status}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    allCoursesList = items;
    allCoursesShown = 0;

    const featuredGrid = document.getElementById("courses-featured-grid");
    const allGrid = document.getElementById("courses-all-grid");

    if (featuredGrid) {
      featuredGrid.innerHTML = "";
      const featured = items.slice(0, 3);
      featured.forEach((c, idx) => {
        featuredGrid.appendChild(createFeaturedCard(c, idx, ownedCourseIds));
      });
    }

    if (allGrid) {
      allGrid.innerHTML = "";
      renderAllBatch();
    }

    initFilters();
    initHoverEffects();
    initViewAllButton();
    initLoadMoreButton();
    initCourseActions();
    initPayModal();
    applyFilterFromUrl();
  } catch (err) {
    console.error(err);
    if (err.needReLogin) {
      openLoginModal();
      alert("登录已过期，请重新登录");
    }
    const featuredGrid = document.getElementById("courses-featured-grid");
    const allGrid = document.getElementById("courses-all-grid");
    if (featuredGrid) {
      featuredGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">加载课程失败，请稍后重试</p>';
    }
    if (allGrid) {
      allGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">加载课程失败，请稍后重试</p>';
    }
    const loadMoreBtn = document.getElementById("load-more-courses-btn");
    if (loadMoreBtn) {
      loadMoreBtn.style.display = "none";
    }
  }
}

function applyFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get("filter");
  if (!filter) return;
  const btn = document.querySelector(`.course-filter-btn[data-filter="${filter}"]`);
  if (btn) btn.click();
}

document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
});

