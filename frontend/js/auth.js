const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USERNAME_KEY = "username";

export function saveAuth(token, role, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (username != null) {
    localStorage.setItem(USERNAME_KEY, username);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
  window.location.href = "index.html";
}

/** 仅清除登录状态，不跳转（用于 token 过期时提示重新登录） */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function requireRole(role) {
  const userRole = getRole();
  if (userRole !== role) {
    alert("无权限访问");
    window.location.href = "index.html";
  }
}
