import { useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Auth Hook
 *
 * Provides authentication methods
 * Integrates with both Liuma Auth SDK and legacy authentication
 */
export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, login: liumaLogin, loginWithLegacy, loginWithDevMode, logout: liumaLogout } = useAuthContext();
  const { user: storeUser, token, setAuth, clearAuth } = useAuthStore();

  // Use Liuma user if available, otherwise fall back to store user
  const currentUser = user || storeUser;

  // Password login (legacy)
  const login = useCallback(async (email: string, password: string) => {
    // Get token from AuthContext which handles the actual login
    await loginWithLegacy(email, password);

    // Also update Zustand store for backward compatibility
    // Get token from localStorage (set by AuthContext)
    const token = localStorage.getItem('token');
    if (token) {
      // Parse JWT to get userId, or derive from email
      let userId = email.split('@')[0];
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.userId || userId;
      } catch {
        // Use derived userId if parsing fails
      }

      const userObj = {
        userId,
        email,
        plan: 'basic',
      };
      setAuth(userObj, token);
    }
  }, [loginWithLegacy, setAuth]);

  // Dev mode login (legacy)
  const loginWithDevModeLegacy = useCallback(async (userId: string, email: string) => {
    await loginWithDevMode(userId, email);

    // Also update Zustand store for backward compatibility
    // Get token from localStorage (set by AuthContext)
    const token = localStorage.getItem('token');
    const backendUserId = userId || email.split('@')[0];

    localStorage.setItem('userId', backendUserId);
    localStorage.setItem('userEmail', email);

    const userObj = {
      userId: backendUserId,
      email,
      plan: 'basic',
    };
    if (token) {
      setAuth(userObj, token);
    }
  }, [loginWithDevMode, setAuth]);

  // OAuth login (Liuma)
  const loginWithOAuth = useCallback(async (provider: 'google' | 'github' | 'wechat') => {
    await liumaLogin(provider);
  }, [liumaLogin]);

  // Logout
  const logout = useCallback(async () => {
    await liumaLogout();

    // Also clear Zustand store
    clearAuth();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('signature');

    router.push('/login');
  }, [liumaLogout, clearAuth, router]);

  return {
    user: currentUser,
    token,
    isAuthenticated,
    login,
    loginWithOAuth,
    loginWithDevMode: loginWithDevModeLegacy,
    logout,
  };
}
