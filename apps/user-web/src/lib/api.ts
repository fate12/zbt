import { getToken } from './auth';

// 生产环境必须由 CI 注入 VITE_API_BASE_URL(指向 API 域名,如 https://api.xxx.com);
// 为空时走同源(开发依赖 Vite 代理 / 生产依赖同域反代)。
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function resolveApiUrl(url: string): string {
  if (!API_BASE || /^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : '/' + url}`;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  if (token) {
    options = {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    };
  }
  return fetch(resolveApiUrl(url), options);
}

export async function apiPost(url: string, body: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' });
}
