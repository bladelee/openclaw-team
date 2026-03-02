/**
 * Liuma Authentication SDK Integration for app-h5
 *
 * 配置说明：
 * - 开发环境：通过 Vite proxy 代理到认证中心
 * - 生产环境：通过 Nginx/Coolify 等反向代理到认证中心
 *
 * 好处：开发和生产环境代码一致，使用相对路径调用 API
 */

import type { User, Session } from "@liuma/auth-sdk";
import { LiumaAuth } from "@liuma/auth-sdk";

/**
 * 认证中心 URL 配置
 *
 * 统一使用当前域名（window.location.origin），这样：
 * - 开发环境：http://localhost:18795/api/auth/... (通过 Vite proxy 代理到认证中心)
 * - 生产环境：https://h5.openclaw.com/api/auth/... (通过 Nginx proxy 代理到认证中心)
 */
const AUTH_CENTER_URL = window.location.origin;

/**
 * Initialize Liuma Auth SDK for mobile H5
 */
export const auth = new LiumaAuth({
  authCenterUrl: AUTH_CENTER_URL,
  appId: import.meta.env.VITE_APP_ID || "openclaw-h5",
  redirectUri: `${window.location.origin}/auth/callback`,
  storagePrefix: "openclaw",
  debug: import.meta.env.DEV,
});

/**
 * Authentication helper functions
 */

export async function login(
  provider: "google" | "github" | "microsoft" | "wechat" | "email" = "google",
): Promise<void> {
  await auth.login(provider);
}

/**
 * Email/Password login (embedded form mode)
 * Uses SDK's built-in signInWithEmailAndPassword method
 */
export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<Session> {
  return auth.signInWithEmailAndPassword(email, password);
}

export async function signUp(email: string, password: string, name: string): Promise<Session> {
  return auth.signUp(email, password, name);
}

export async function logout(): Promise<void> {
  await auth.logout();
}

export async function getSession(): Promise<Session | null> {
  return auth.getSession();
}

export async function getUser(): Promise<User | null> {
  return auth.getUser();
}

export async function isAuthenticated(): Promise<boolean> {
  return auth.isAuthenticated();
}

export async function refreshToken(): Promise<string | null> {
  return auth.refreshToken();
}

export function getHTTPClient() {
  return auth.getHTTPClient();
}

export async function forgotPassword(
  email: string,
  redirectTo?: string,
): Promise<{ success: boolean; message: string }> {
  return auth.forgotPassword(email, redirectTo);
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; message: string; user?: any }> {
  return auth.resetPassword(token, newPassword);
}
