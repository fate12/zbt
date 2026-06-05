/**
 * Shared auth helpers — consistent token extraction for all API calls.
 *
 * Priority:
 *   1. window.__SUPABASE_ACCESS_TOKEN__  (runtime injection by host)
 *   2. Cookie 'access_token'              (set during OAuth redirect)
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
  return (window as any).__SUPABASE_ACCESS_TOKEN__ || getCookie('access_token');
};

export function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 跳转到钉钉 OAuth 登录页。
 * 登录完成后会通过 continue_url 回到当前页面。
 */
export function redirectToLogin(): void {
  const gateway = import.meta.env.VITE_AI_GATEWAY_URL || 'https://ai-app.dingtalk.com';
  const continueUrl = window.location.href;
  const loginUrl = `${gateway}/oauth/dingtalk-login?continue_url=${encodeURIComponent(continueUrl)}`;
  window.location.href = loginUrl;
}
