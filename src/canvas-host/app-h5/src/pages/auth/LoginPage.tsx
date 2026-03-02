/**
 * Login Page
 * 用户登录页面 - 使用 Liuma Auth SDK
 * 移动端优化布局，参考 liuma 移动端设计
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";

export function LoginPage() {
  const { login: oauthLogin, isLoading } = useAuth();
  const { signInWithEmailAndPassword } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 邮箱密码登录（使用 SDK 内嵌式 API）
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("auth.email") + "和" + t("auth.password") + "不能为空");
      return;
    }

    try {
      setIsLoggingIn(true);
      setError(null);

      // 使用 AuthContext 的 signInWithEmailAndPassword 方法
      await signInWithEmailAndPassword(email, password);

      // 登录成功，跳转到实例列表页
      navigate("/instances");
    } catch (err: any) {
      console.error("Email login failed:", err);
      const errorMessage = err?.message || err?.error || t("common.failed");
      setError(errorMessage);
      setIsLoggingIn(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    try {
      setIsLoggingIn(true);
      setError(null);
      await oauthLogin(provider);
    } catch (err) {
      console.error("OAuth login failed:", err);
      setError(err instanceof Error ? err.message : t("common.failed"));
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 顶部标题栏 */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        <p className="text-sm text-center text-gray-600">AI Agent 控制中心</p>
      </div>

      {/* 登录表单卡片 */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            {t("auth.login")}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {/* 邮箱密码登录表单 */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoggingIn || isLoading}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn || isLoading}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
                placeholder="•••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || isLoading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoggingIn ? t("auth.loggingIn") : t("auth.login")}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t("auth.orLogin")}</span>
            </div>
          </div>

          {/* 第三方登录 */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin("google")}
              disabled={isLoggingIn || isLoading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-sm font-medium">{t("auth.googleLogin")}</span>
            </button>

            <button
              onClick={() => handleOAuthLogin("github")}
              disabled={isLoggingIn || isLoading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.411 1.235 2.381 0 4.609-2.807 5.624-5.479 5.921.43.372.723 1.102.723 2.222 0 1.606-.015 2.898-.015 3.293 0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm font-medium">{t("auth.githubLogin")}</span>
            </button>
          </div>

          {isLoggingIn && (
            <div className="text-center text-sm text-gray-600">{t("auth.loggingIn")}</div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            {t("auth.register")}
          </Link>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="px-4 pb-6 text-center">
        <p className="text-xs text-gray-500">由 OpenClaw 提供技术支持</p>
      </div>
    </div>
  );
}
