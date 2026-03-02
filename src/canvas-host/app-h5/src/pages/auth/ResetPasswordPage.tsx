/**
 * Reset Password Page
 * 密码重置页面 - 使用 Liuma Auth SDK
 */

import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useI18n } from "../../contexts/I18nContext";
import { resetPassword } from "../../lib/auth";

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  // 如果没有 token，显示错误
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* 顶部标题栏 */}
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        </div>

        {/* 错误消息卡片 */}
        <div className="flex-1 px-4 pb-8 flex items-center justify-center">
          <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.invalidLink")}</h2>
            <p className="text-gray-600 mb-6">{t("auth.invalidLinkDesc")}</p>

            <Link
              to="/forgot-password"
              className="inline-block w-full bg-blue-600 text-white text-center rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors font-medium"
            >
              {t("auth.getNewLink")}
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

  // 密码验证规则
  const passwordValidation = {
    hasMinLength: formData.password.length >= 6 && formData.password.length <= 20,
    hasLetter: /[a-zA-Z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
  };

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError(t("auth.passwordInvalid"));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    try {
      setIsLoading(true);

      // 使用 Liuma Auth SDK 重置密码
      const result = await resetPassword(token, formData.password);

      if (result.success) {
        setSuccess(true);
        // 3秒后跳转到登录页
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setError(result.message || t("common.failed"));
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Reset password failed:", err);
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

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.passwordReset")}</h2>
            <p className="text-gray-600 mb-6">{t("auth.passwordResetDesc")}</p>
            <p className="text-sm text-gray-500 mb-6">{t("auth.redirectingToLogin")}</p>

            <Link
              to="/login"
              className="inline-block w-full bg-blue-600 text-white text-center rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors font-medium"
            >
              {t("auth.login")}
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 顶部标题栏 */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        <p className="text-sm text-center text-gray-600">{t("auth.setNewPassword")}</p>
      </div>

      {/* 表单卡片 */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.resetPassword")}</h2>
          <p className="text-sm text-gray-600 mb-6">{t("auth.forgotPasswordDesc")}</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t("auth.newPassword")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t("auth.passwordPlaceholder")}
                disabled={isLoading}
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t("auth.confirmNewPassword")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t("auth.confirmPasswordPlaceholder")}
                disabled={isLoading}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
                autoComplete="new-password"
              />
            </div>

            {/* 密码验证提示 */}
            {formData.password && (
              <div className="mt-2 space-y-2 text-sm">
                <div
                  className={`flex items-center ${passwordValidation.hasMinLength ? "text-green-600" : "text-gray-500"}`}
                >
                  {passwordValidation.hasMinLength ? "✓" : "○"} {t("auth.passwordMinLength")}
                </div>
                <div
                  className={`flex items-center ${passwordValidation.hasLetter ? "text-green-600" : "text-gray-500"}`}
                >
                  {passwordValidation.hasLetter ? "✓" : "○"} {t("auth.passwordHasLetter")}
                </div>
                <div
                  className={`flex items-center ${passwordValidation.hasNumber ? "text-green-600" : "text-gray-500"}`}
                >
                  {passwordValidation.hasNumber ? "✓" : "○"} {t("auth.passwordHasNumber")}
                </div>
                {formData.confirmPassword && (
                  <div
                    className={`flex items-center ${formData.password === formData.confirmPassword ? "text-green-600" : "text-red-600"}`}
                  >
                    {formData.password === formData.confirmPassword ? "✓" : "✗"}{" "}
                    {t("auth.passwordMatch")}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isLoading || !isPasswordValid || formData.password !== formData.confirmPassword
              }
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
            >
              {isLoading ? t("auth.resetting") : t("auth.resetPasswordBtn")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              {t("auth.backToLogin")}
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
