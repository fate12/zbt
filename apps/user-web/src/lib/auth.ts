export function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}

export const getToken = (): string | null => {
  return localStorage.getItem('zhibotong_token') || (window as any).__SUPABASE_ACCESS_TOKEN__ || getCookie('access_token');
};

export function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
