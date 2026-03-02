/**
 * Authentication Context Provider
 * Provides auth state and functions to all components
 */

import type { User, Session } from "@liuma/auth-sdk";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth as authInstance } from "../lib/auth";

interface AuthContextType {
  auth: typeof authInstance;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider?: "google" | "github" | "microsoft" | "wechat" | "email") => Promise<void>;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check existing session on mount
    const loadSession = async () => {
      try {
        const sessionData = await authInstance.getSession();
        if (sessionData) {
          setSession(sessionData);
          setUser(sessionData.user);
        }
      } catch (error) {
        // 静默处理session获取失败 - 这在首次访问时是正常的
        // 只在开发模式下输出调试信息
        if (import.meta.env.DEV) {
          console.debug("No existing session found (this is normal for first-time visitors)");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  const login = async (
    provider: "google" | "github" | "microsoft" | "wechat" | "email" = "google",
  ) => {
    await authInstance.login(provider);
  };

  const signInWithEmailAndPassword = async (email: string, password: string) => {
    // 调用 SDK 的登录方法
    const sessionData = await authInstance.signInWithEmailAndPassword(email, password);

    // 直接更新 context 状态，避免额外的 storage 读取
    setSession(sessionData);
    setUser(sessionData.user);
  };

  const logout = async () => {
    try {
      // 尝试调用后端登出 API
      await authInstance.logout();
    } catch (error) {
      // 后端可能没有实现 /api/auth/signout 端点，忽略错误
      // 只要在开发环境就记录一下
      if (import.meta.env.DEV) {
        console.debug("Backend logout endpoint not available, clearing local state only");
      }
    } finally {
      // 无论后端调用成功与否，都清除本地状态
      setSession(null);
      setUser(null);
    }
  };

  const refreshSession = async () => {
    const sessionData = await authInstance.getSession();
    if (sessionData) {
      setSession(sessionData);
      setUser(sessionData.user);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    auth: authInstance,
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    signInWithEmailAndPassword,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
