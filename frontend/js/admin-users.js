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

let currentUsers = [];
let currentPage = 1;
const pageSize = 20;
let currentFilters = {
  role: "",
  status: "",
  keyword: "",
};

// 获取用户统计
async function fetchUserStats() {
  try {
    const res = await fetch(`${API_BASE}/users/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById("user-stat-total").textContent = data.total || 0;
    document.getElementById("user-stat-admins").textContent = data.admins || 0;
    document.getElementById("user-stat-members").textContent = data.members || 0;
    document.getElementById("user-stat-today").textContent = data.todayNew || 0;
  } catch (err) {
    console.error("获取用户统计失败:", err);
  }
}

// 获取用户列表
async function fetchUsers() {
  try {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: pageSize.toString(),
    });

    if (currentFilters.role) params.append("role", currentFilters.role);
    if (currentFilters.status) params.append("status", currentFilters.status);
    if (currentFilters.keyword) params.append("keyword", currentFilters.keyword);

    const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取用户列表失败：${res.status}`);
    }

    const data = await res.json();
    currentUsers = Array.isArray(data.items) ? data.items : [];
    renderUserTable(data);
    return data;
  } catch (err) {
    console.error(err);
    alert("获取用户列表失败，请确认已登录且为管理员账号。");
    return null;
  }
}

function formatRole(role) {
  return role === "admin" ? "管理员" : "普通用户";
}

function formatStatus(status) {
  if (status === "active") return { text: "正常", cls: "bg-green-100 text-green-700" };
  if (status === "disabled") return { text: "已禁用", cls: "bg-red-100 text-red-700" };
  return { text: "未知", cls: "bg-gray-100 text-gray-700" };
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderUserTable(data) {
  const tbody = document.getElementById("user-table-body");
  const summary = document.getElementById("user-table-summary");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || !data.items || data.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-8 text-center text-gray-500">暂无用户数据</td>
      </tr>
    `;
    return;
  }

  data.items.forEach((u) => {
    const statusInfo = formatStatus(u.status);
    const tr = document.createElement("tr");
    tr.className = "border-b hover:bg-gray-50";
    tr.innerHTML = `
      <td class="py-3 px-4">
        <input type="checkbox" class="user-checkbox rounded border-gray-300" data-id="${u.id}">
      </td>
      <td class="py-3 px-4 font-medium text-gray-900">${u.username || ""}</td>
      <td class="py-3 px-4 text-gray-700 text-sm">${u.phone || "-"}</td>
      <td class="py-3 px-4 text-gray-700 text-sm">${u.email || "-"}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-1 rounded text-xs font-medium ${
          u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
        }">${formatRole(u.role)}</span>
      </td>
      <td class="py-3 px-4">
        <span class="px-2 py-1 rounded text-xs font-medium ${statusInfo.cls}">${statusInfo.text}</span>
      </td>
      <td class="py-3 px-4 text-gray-700 text-sm">${formatDateTime(u.createdAt)}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button
            type="button"
            data-id="${u.id}"
            class="btn-video-action btn-video-edit js-user-edit-btn"
            title="编辑用户"
            onclick="if(window.openEditUserModal){window.openEditUserModal('${u.id}');event.stopPropagation();return false;}"
          >
            编辑
          </button>
          <button
            type="button"
            data-id="${u.id}"
            data-status="${u.status}"
            class="btn-video-action ${u.status === "active" ? "btn-video-delete" : "btn-video-edit"} js-user-toggle-status-btn"
            title="${u.status === "active" ? "禁用" : "启用"}"
            onclick="if(window.toggleUserStatus){window.toggleUserStatus('${u.id}','${u.status}');event.stopPropagation();return false;}"
          >
            ${u.status === "active" ? "禁用" : "启用"}
          </button>
          <button
            type="button"
            data-id="${u.id}"
            class="btn-video-action btn-video-delete js-user-delete-btn"
            title="删除"
            onclick="if(window.deleteUser){window.deleteUser('${u.id}');event.stopPropagation();return false;}"
          >
            删除
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 更新统计信息
  if (summary) {
    summary.textContent = `共 ${data.total || 0} 位用户`;
  }

  // 更新分页信息
  const pageInfoEl = document.getElementById("user-page-info");
  if (pageInfoEl) {
    pageInfoEl.textContent = `第 ${data.page || 1} 页 / 共 ${data.totalPages || 1} 页`;
  }

  // 更新分页按钮状态
  const prevBtn = document.getElementById("user-prev-btn");
  const nextBtn = document.getElementById("user-next-btn");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= (data.totalPages || 1);

  // 更新全选状态
  updateSelectAllState();
}

// 更新全选状态
function updateSelectAllState() {
  const checkboxes = document.querySelectorAll(".user-checkbox");
  const selectAll = document.getElementById("user-select-all");
  const batchDeleteBtn = document.getElementById("user-batch-delete-btn");

  if (!selectAll) return;

  const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;
  selectAll.checked = checkedCount > 0 && checkedCount === checkboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;

  // 显示/隐藏批量删除按钮
  if (batchDeleteBtn) {
    if (checkedCount > 0) {
      batchDeleteBtn.classList.remove("hidden");
    } else {
      batchDeleteBtn.classList.add("hidden");
    }
  }
}

// 打开编辑用户弹窗
async function openEditUserModal(id) {
  console.log("openEditUserModal 被调用，ID:", id);
  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`获取用户信息失败：${res.status}`);
    }

    const user = await res.json();
    console.log("获取到的用户数据:", user);

    // 填充编辑表单
    const userIdInput = document.getElementById("edit-user-id");
    const usernameInput = document.getElementById("edit-username");
    const phoneInput = document.getElementById("edit-phone");
    const emailInput = document.getElementById("edit-email");
    const roleSelect = document.getElementById("edit-role");
    const statusSelect = document.getElementById("edit-status");
    const createdAtP = document.getElementById("edit-createdAt");

    if (!userIdInput || !usernameInput || !phoneInput) {
      console.error("找不到表单元素");
      alert("表单元素未找到，请刷新页面重试");
      return;
    }

    userIdInput.value = user.id;
    usernameInput.value = user.username || "";
    phoneInput.value = user.phone || "";
    emailInput.value = user.email || "";
    roleSelect.value = user.role || "member";
    statusSelect.value = user.status || "active";
    createdAtP.textContent = formatDateTime(user.createdAt) || "-";

    // 显示弹窗
    const modal = document.getElementById("user-edit-modal");
    if (!modal) {
      console.error("找不到弹窗元素 user-edit-modal");
      alert("弹窗元素未找到，请刷新页面重试");
      return;
    }
    
    console.log("找到弹窗元素，准备显示");
    console.log("弹窗当前状态:", {
      display: modal.style.display,
      classList: Array.from(modal.classList),
      computedDisplay: window.getComputedStyle(modal).display,
      offsetWidth: modal.offsetWidth,
      offsetHeight: modal.offsetHeight
    });
    
    // 直接设置样式，不使用类
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    
    // 移除可能干扰的类
    modal.classList.remove("hidden");
    
    console.log("弹窗显示后状态:", {
      display: modal.style.display,
      computedDisplay: window.getComputedStyle(modal).display,
      offsetWidth: modal.offsetWidth,
      offsetHeight: modal.offsetHeight
    });
    
    // 验证弹窗是否可见
    setTimeout(() => {
      const computed = window.getComputedStyle(modal);
      const isVisible = computed.display !== "none" && modal.offsetWidth > 0 && modal.offsetHeight > 0;
      console.log("弹窗最终状态:", {
        computedDisplay: computed.display,
        offsetWidth: modal.offsetWidth,
        offsetHeight: modal.offsetHeight,
        isVisible: isVisible
      });
      
      if (!isVisible) {
        console.error("弹窗仍然不可见，尝试强制显示");
        // 最后尝试：完全重置样式
        modal.removeAttribute("class");
        modal.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex !important; align-items: center; justify-content: center;";
      }
    }, 50);
  } catch (err) {
    console.error("获取用户信息失败:", err);
    alert("获取用户信息失败: " + err.message);
  }
}

// 保存用户编辑
async function saveUserEdit(event) {
  event.preventDefault();

  const id = document.getElementById("edit-user-id").value;
  const username = document.getElementById("edit-username").value.trim();
  const phone = document.getElementById("edit-phone").value.trim();
  const email = document.getElementById("edit-email").value.trim();
  const role = document.getElementById("edit-role").value;
  const status = document.getElementById("edit-status").value;

  if (!username || !phone) {
    alert("用户名和手机号不能为空");
    return;
  }

  // 敏感操作二次确认
  const ok = confirm(
    `你正在修改用户信息（敏感操作）\n\n用户ID：${id}\n用户名：${username}\n角色：${formatRole(role)}\n状态：${formatStatus(status).text}\n\n确定继续吗？`
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username,
        phone,
        email: email || null,
        role,
        status,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || `更新失败：${res.status}`);
    }

    alert("用户信息已更新");
    closeEditUserModal();
    fetchUsers();
    fetchUserStats();
  } catch (err) {
    console.error(err);
    alert(err.message || "更新用户信息失败");
  }
}

// 关闭编辑弹窗
function closeEditUserModal() {
  const modal = document.getElementById("user-edit-modal");
  if (modal) {
    modal.style.display = "none";
    modal.style.alignItems = "";
    modal.style.justifyContent = "";
    modal.classList.add("hidden");
  }
  // 重置表单
  const form = document.getElementById("user-edit-form");
  if (form) form.reset();
}

// 切换用户状态
async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === "active" ? "disabled" : "active";
  const action = newStatus === "disabled" ? "禁用" : "启用";

  const ok = confirm(`确定要${action}该用户吗？`);
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/users/${id}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `更新失败：${res.status}`);
    }

    alert(`用户已${action}`);
    fetchUsers();
    fetchUserStats();
  } catch (err) {
    console.error(err);
    alert(`${action}用户失败`);
  }
}

// 删除用户
async function deleteUser(id) {
  const user = currentUsers.find((u) => String(u.id) === String(id));
  const username = user?.username || id;

  const ok = confirm(`你正在删除用户（敏感操作）\n\n用户：${username}\n\n确定继续吗？`);
  if (!ok) return;

  const typed = prompt(`请输入 DELETE 以确认删除用户「${username}」：`, "");
  if (typed !== "DELETE") {
    alert("已取消：未通过二次确认");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `删除失败：${res.status}`);
    }

    alert("用户已删除");
    fetchUsers();
    fetchUserStats();
  } catch (err) {
    console.error(err);
    alert("删除用户失败");
  }
}

// 批量删除
async function batchDeleteUsers() {
  const checked = Array.from(document.querySelectorAll(".user-checkbox:checked"));
  const ids = checked.map((cb) => cb.dataset.id);

  if (ids.length === 0) {
    alert("请先选择要删除的用户");
    return;
  }

  const ok = confirm(`你正在批量删除用户（敏感操作）\n\n已选择 ${ids.length} 个用户\n\n确定继续吗？`);
  if (!ok) return;

  const typed = prompt(`请输入 DELETE 以确认批量删除 ${ids.length} 个用户：`, "");
  if (typed !== "DELETE") {
    alert("已取消：未通过二次确认");
    return;
  }

  try {
    // 逐个删除（后端暂不支持批量删除接口）
    for (const id of ids) {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`删除用户 ${id} 失败`);
      }
    }

    alert(`已删除 ${ids.length} 个用户`);
    fetchUsers();
    fetchUserStats();
  } catch (err) {
    console.error(err);
    alert("批量删除失败");
  }
}

// 绑定事件
function bindUserEvents() {
  // 筛选按钮
  const filterBtn = document.getElementById("user-filter-btn");
  if (filterBtn) {
    filterBtn.addEventListener("click", () => {
      const roleSelect = document.getElementById("user-filter-role");
      const statusSelect = document.getElementById("user-filter-status");
      const keywordInput = document.getElementById("user-search-input");

      currentFilters = {
        role: roleSelect?.value || "",
        status: statusSelect?.value || "",
        keyword: keywordInput?.value.trim() || "",
      };

      currentPage = 1;
      fetchUsers();
    });
  }

  // 重置按钮
  const resetBtn = document.getElementById("user-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      document.getElementById("user-filter-role").value = "";
      document.getElementById("user-filter-status").value = "";
      document.getElementById("user-search-input").value = "";
      currentFilters = { role: "", status: "", keyword: "" };
      currentPage = 1;
      fetchUsers();
    });
  }

  // 搜索框回车
  const searchInput = document.getElementById("user-search-input");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        filterBtn?.click();
      }
    });
  }

  // 全选
  const selectAll = document.getElementById("user-select-all");
  if (selectAll) {
    selectAll.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".user-checkbox");
      checkboxes.forEach((cb) => {
        cb.checked = e.target.checked;
      });
      updateSelectAllState();
    });
  }

  // 单个复选框
  const tbody = document.getElementById("user-table-body");
  if (tbody) {
    tbody.addEventListener("change", (e) => {
      if (e.target.classList.contains("user-checkbox")) {
        updateSelectAllState();
      }
    });

    tbody.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".js-user-edit-btn");
      const toggleBtn = e.target.closest(".js-user-toggle-status-btn");
      const deleteBtn = e.target.closest(".js-user-delete-btn");

      if (editBtn && editBtn.dataset.id) {
        e.preventDefault();
        e.stopPropagation();
        console.log("点击编辑按钮，用户ID:", editBtn.dataset.id);
        openEditUserModal(editBtn.dataset.id);
        return;
      }
      
      if (toggleBtn && toggleBtn.dataset.id) {
        e.preventDefault();
        e.stopPropagation();
        toggleUserStatus(toggleBtn.dataset.id, toggleBtn.dataset.status);
        return;
      }
      
      if (deleteBtn && deleteBtn.dataset.id) {
        e.preventDefault();
        e.stopPropagation();
        deleteUser(deleteBtn.dataset.id);
        return;
      }
    });
  }

  // 批量删除
  const batchDeleteBtn = document.getElementById("user-batch-delete-btn");
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener("click", batchDeleteUsers);
  }

  // 分页按钮
  const prevBtn = document.getElementById("user-prev-btn");
  const nextBtn = document.getElementById("user-next-btn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        fetchUsers();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentPage++;
      fetchUsers();
    });
  }

  // 编辑弹窗事件
  const editForm = document.getElementById("user-edit-form");
  const editCloseBtn = document.getElementById("user-edit-close");
  const editCancelBtn = document.getElementById("user-edit-cancel");
  const editModal = document.getElementById("user-edit-modal");

  if (editForm) {
    editForm.addEventListener("submit", saveUserEdit);
  }

  if (editCloseBtn) {
    editCloseBtn.addEventListener("click", closeEditUserModal);
  }

  if (editCancelBtn) {
    editCancelBtn.addEventListener("click", closeEditUserModal);
  }

  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        closeEditUserModal();
      }
    });
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  bindUserEvents();
  fetchUserStats();
  fetchUsers();

  // 将函数暴露到全局，方便 onclick 调用
  window.openEditUserModal = openEditUserModal;
  window.toggleUserStatus = toggleUserStatus;
  window.deleteUser = deleteUser;

  // 当切换到用户管理模块时刷新数据
  const userSection = document.getElementById("section-users");
  if (userSection) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const isVisible = userSection.style.display !== "none";
          if (isVisible) {
            fetchUserStats();
            fetchUsers();
          }
        }
      });
    });

    observer.observe(userSection, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
});
