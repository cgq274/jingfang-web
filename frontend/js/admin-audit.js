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

let currentPage = 1;
let pageSize = 10;
let lastTotalPages = 1;
let currentFilters = {
  action: "",
  resourceType: "",
  username: "",
};

// 获取操作类型的中文显示
function getActionLabel(action) {
  const map = {
    create: "创建",
    update: "更新",
    delete: "删除",
    login: "登录",
    login_failed: "登录失败",
  };
  return map[action] || action;
}

// 获取资源类型的中文显示
function getResourceTypeLabel(type) {
  const map = {
    video: "视频",
    course: "课程",
    user: "用户",
    settings: "系统设置",
    auth: "认证",
  };
  return map[type] || type;
}

// 格式化时间
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 获取日志列表
async function fetchAuditLogs() {
  try {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: pageSize.toString(),
    });

    if (currentFilters.action) {
      params.append("action", currentFilters.action);
    }
    if (currentFilters.resourceType) {
      params.append("resourceType", currentFilters.resourceType);
    }
    if (currentFilters.username) {
      params.append("username", currentFilters.username);
    }

    const res = await fetch(`${API_BASE}/audit-logs?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取操作日志失败：${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    alert("获取操作日志失败，请确认已登录且为管理员账号。");
    return null;
  }
}

// 渲染日志表格
function renderAuditTable(data) {
  const tbody = document.getElementById("audit-table-body");
  if (!tbody) return;

  if (!data || !data.items || data.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-gray-500">暂无操作日志</td>
      </tr>
    `;
    lastTotalPages = 1;
    const summaryEl = document.getElementById("audit-table-summary");
    const pageInfoEl = document.getElementById("audit-page-info");
    const prevBtn = document.getElementById("audit-prev-btn");
    const nextBtn = document.getElementById("audit-next-btn");
    if (summaryEl) summaryEl.textContent = `共 ${data?.total ?? 0} 条记录`;
    if (pageInfoEl) pageInfoEl.textContent = `第 1 页 / 共 1 页`;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    const pageSizeSelect = document.getElementById("audit-page-size");
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
    return;
  }

  tbody.innerHTML = data.items
    .map(
      (log) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4 text-sm text-gray-700">${formatDateTime(log.createdAt)}</td>
      <td class="py-3 px-4 text-sm text-gray-700">${log.username}</td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-1 rounded text-xs font-medium ${
          log.action === "create"
            ? "bg-green-100 text-green-700"
            : log.action === "update"
            ? "bg-blue-100 text-blue-700"
            : log.action === "delete"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-700"
        }">${getActionLabel(log.action)}</span>
      </td>
      <td class="py-3 px-4 text-sm text-gray-700">${getResourceTypeLabel(log.resourceType)}</td>
      <td class="py-3 px-4 text-sm text-gray-700">${log.resourceTitle || "-"}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${log.ipAddress || "-"}</td>
    </tr>
  `
    )
    .join("");

  // 更新统计信息
  const summaryEl = document.getElementById("audit-table-summary");
  if (summaryEl) {
    summaryEl.textContent = `共 ${data.total || 0} 条记录`;
  }

  // 更新分页信息
  lastTotalPages = data.totalPages || 1;
  const pageInfoEl = document.getElementById("audit-page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `第 ${data.page || 1} 页 / 共 ${lastTotalPages} 页`;
  }

  // 更新分页按钮状态
  const prevBtn = document.getElementById("audit-prev-btn");
  const nextBtn = document.getElementById("audit-next-btn");
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage >= lastTotalPages || lastTotalPages <= 1;
  }

  // 同步每页条数下拉框
  const pageSizeSelect = document.getElementById("audit-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.value = String(pageSize);
  }
}

// 加载并显示日志
async function loadAuditLogs() {
  const data = await fetchAuditLogs();
  if (data) {
    renderAuditTable(data);
  }
}

// 绑定事件
function bindEvents() {
  // 筛选按钮
  const filterBtn = document.getElementById("audit-filter-btn");
  if (filterBtn) {
    filterBtn.addEventListener("click", () => {
      const actionSelect = document.getElementById("audit-filter-action");
      const resourceSelect = document.getElementById("audit-filter-resource");
      const usernameInput = document.getElementById("audit-filter-username");

      currentFilters = {
        action: actionSelect?.value || "",
        resourceType: resourceSelect?.value || "",
        username: usernameInput?.value || "",
      };

      currentPage = 1;
      loadAuditLogs();
    });
  }

  // 刷新按钮
  const refreshBtn = document.getElementById("audit-refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAuditLogs();
    });
  }

  // 导出 CSV
  const exportBtn = document.getElementById("audit-export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        const params = new URLSearchParams();
        if (currentFilters.action) params.append("action", currentFilters.action);
        if (currentFilters.resourceType) params.append("resourceType", currentFilters.resourceType);
        if (currentFilters.username) params.append("username", currentFilters.username);

        const res = await fetch(`${API_BASE}/audit-logs/export?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error(`导出失败：${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert("导出操作日志失败");
      }
    });
  }

  // 上一页
  const prevBtn = document.getElementById("audit-prev-btn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadAuditLogs();
      }
    });
  }

  // 下一页
  const nextBtn = document.getElementById("audit-next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentPage < lastTotalPages) {
        currentPage++;
        loadAuditLogs();
      }
    });
  }

  // 每页条数
  const pageSizeSelect = document.getElementById("audit-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = Math.max(1, parseInt(e.target.value, 10) || 10);
      currentPage = 1;
      loadAuditLogs();
    });
  }

  // 回车键筛选
  const usernameInput = document.getElementById("audit-filter-username");
  if (usernameInput) {
    usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        filterBtn?.click();
      }
    });
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  
  // 当切换到操作日志模块时加载数据
  const auditSection = document.getElementById("section-audit");
  if (auditSection) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const isVisible = auditSection.style.display !== "none";
          if (isVisible) {
            loadAuditLogs();
          }
        }
      });
    });
    
    observer.observe(auditSection, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
});
