/**
 * Shared auth helpers — consistent token extraction for all API calls.
 *
 * Priority:
 *   1. Cookie 'access_token'
 *   2. window.__SUPABASE_ACCESS_TOKEN__  (runtime injection by host)
 */

export function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export const getToken = (): string | null => {
  return getCookie('access_token') || (window as any).__SUPABASE_ACCESS_TOKEN__ || null;
};

export function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 保存 token 到 cookie（7天有效） */
export function setToken(token: string): void {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `access_token=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** 清除 token，跳转登录页 */
export function clearToken(): void {
  document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
  (window as any).__SUPABASE_ACCESS_TOKEN__ = undefined;
}

/** 跳转到登录页 */
export function redirectToLogin(): void {
  window.location.href = '/login';
}
