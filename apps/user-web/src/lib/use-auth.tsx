import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { resolveApiUrl } from './api';

interface AuthUser {
  emp_id: string;
  name: string;
  corp_id: string;
  track_description?: string;
  tags?: string[];
  interests?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (account_name: string, account_password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('zhibotong_token');

  // 检查已登录状态
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(resolveApiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setUser(data.data);
        } else {
          localStorage.removeItem('zhibotong_token');
        }
      })
      .catch(() => localStorage.removeItem('zhibotong_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (account_name: string, account_password: string) => {
    const res = await fetch(resolveApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name, account_password }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '登录失败');
    }

    localStorage.setItem('zhibotong_token', data.data.token);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('zhibotong_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 带认证的 fetch
export function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('zhibotong_token');
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
