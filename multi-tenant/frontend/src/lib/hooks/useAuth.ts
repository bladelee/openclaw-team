import { useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  // 密码登录
  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    // Use the userId returned by backend, not email.split('@')[0]
    const user = {
      userId: response.userId,
      email: response.email || email,
      plan: response.plan || 'basic',
    };
    setAuth(user, response.token);
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
  }, [setAuth]);

  // 开发环境快捷登录（使用 Shared Secret）
  // 注意：只进行身份验证，不自动创建租户
  const loginWithDevMode = useCallback(async (userId: string, email: string) => {
    // 调用登录接口获取真实的 JWT token
    const response = await authApi.login({ email, password: 'dev-mode-placeholder' });

    // Use the userId returned by backend for consistency
    const backendUserId = response.userId || email.split('@')[0];

    // 保存用户信息供后续创建租户使用
    localStorage.setItem('userId', backendUserId);
    localStorage.setItem('userEmail', email);

    const user = {
      userId: backendUserId,
      email,
      plan: 'basic',
    };
    setAuth(user, response.token);
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);

    return { success: true };
  }, [setAuth]);

  // OAuth 登录
  const loginWithOAuth = useCallback((provider: 'google' | 'github') => {
    // 在实际实现中，这里会跳转到 OAuth 提供商
    window.location.href = `/api/auth/${provider}`;
  }, []);

  // 登出
  const logout = useCallback(async () => {
    clearAuth();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('signature');
    router.push('/login');
  }, [clearAuth, router]);

  return {
    user,
    token,
    isAuthenticated,
    login,
    loginWithOAuth,
    loginWithDevMode,
    logout,
  };
}
