/**
 * Forgot Password Page
 * 忘记密码页面 - 使用 Liuma Auth SDK
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../contexts/I18nContext";
import { forgotPassword } from "../../lib/auth";

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }

    try {
      setIsLoading(true);

      // 使用 Liuma Auth SDK 发送密码重置邮件
      const result = await forgotPassword(email, window.location.origin + "/reset-password");

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message || t("common.failed"));
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("Send reset email failed:", err);
      const errorMessage = err?.message || err?.error || t("common.failed");
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* 顶部标题栏 */}
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        </div>

        {/* 成功消息卡片 */}
        <div className="flex-1 px-4 pb-8 flex items-center justify-center">
          <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.emailSent")}</h2>
            <p className="text-gray-600 mb-6">
              {t("auth.emailSentDesc").replace("{email}", email)}
            </p>
            <p className="text-sm text-gray-500 mb-6">{t("auth.emailSentHint")}</p>

            <Link
              to="/login"
              className="inline-block w-full bg-blue-600 text-white text-center rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors font-medium"
            >
              {t("auth.backToLogin")}
            </Link>

            <button
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
              disabled={isLoading}
              className="w-full mt-3 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {t("auth.resendEmail")}
            </button>
          </div>
        </div>

        {/* 底部装饰 */}
        <div className="px-4 pb-6 text-center">
          <p className="text-xs text-gray-500">由 OpenClaw 提供技术支持</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 顶部标题栏 */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        <p className="text-sm text-center text-gray-600">{t("auth.resetPassword")}</p>
      </div>

      {/* 表单卡片 */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6">
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t("auth.backToLogin")}
            </Link>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t("auth.forgotPasswordTitle")}
          </h2>
          <p className="text-sm text-gray-600 mb-6">{t("auth.forgotPasswordDesc")}</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t("auth.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={isLoading}
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
            >
              {isLoading ? t("auth.sending") : t("auth.sendResetEmail")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {t("auth.rememberPassword")}{" "}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              {t("auth.login")}
            </Link>
          </div>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="px-4 pb-6 text-center">
        <p className="text-xs text-gray-500">由 OpenClaw 提供技术支持</p>
      </div>
    </div>
  );
}
