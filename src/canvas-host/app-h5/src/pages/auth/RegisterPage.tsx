/**
 * Register Page
 * 用户注册页面 - 使用 Liuma Auth SDK
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../../contexts/I18nContext";
import { signUp } from "../../lib/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
  });

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

  // 步骤1: 验证邮箱
  const handleEmailStep = async () => {
    setError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setStep(2);
  };

  // 步骤2: 验证姓名
  const handleNameStep = () => {
    setError(null);
    if (formData.name.trim().length < 2) {
      setError(t("auth.nameTooShort"));
      return;
    }
    setStep(3);
  };

  // 步骤3: 提交注册
  const handleSubmit = async () => {
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

      // 使用 Liuma Auth SDK 注册
      await signUp(formData.email, formData.password, formData.name);

      // 注册成功，跳转到实例列表页
      navigate("/instances");
    } catch (err: any) {
      console.error("Registration failed:", err);
      // 错误消息可能来自 SDK
      const errorMessage = err?.message || err?.error || t("auth.registrationFailed");
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          {t("auth.stepEmail")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="your@email.com"
          disabled={isLoading}
          autoFocus
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
          autoComplete="email"
        />
        <p className="mt-2 text-sm text-gray-500">{t("auth.emailHint")}</p>
      </div>

      <button
        onClick={handleEmailStep}
        disabled={isLoading || !formData.email}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
      >
        {t("auth.continue")}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          {t("auth.stepName")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder={t("auth.namePlaceholder")}
          disabled={isLoading}
          autoFocus
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
          autoComplete="name"
        />
        <p className="mt-2 text-sm text-gray-500">{t("auth.nameHint")}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          disabled={isLoading}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {t("auth.back")}
        </button>
        <button
          onClick={handleNameStep}
          disabled={isLoading || !formData.name}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {t("auth.continue")}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          {t("auth.stepPassword")}
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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base mb-3"
          autoComplete="new-password"
        />

        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder={t("auth.confirmPasswordPlaceholder")}
          disabled={isLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
          autoComplete="new-password"
        />

        {/* 密码验证提示 */}
        {formData.password && (
          <div className="mt-3 space-y-2 text-sm">
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
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(2)}
          disabled={isLoading}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {t("auth.back")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !isPasswordValid || formData.password !== formData.confirmPassword}
          className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? t("auth.signingUp") : t("auth.completeRegistration")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 顶部标题栏 */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">OpenClaw</h1>
        <p className="text-sm text-center text-gray-600">{t("auth.createAccount")}</p>
      </div>

      {/* 注册表单卡片 */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-sm p-6">
          {/* 进度指示器 */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div
              className={`h-2 flex-1 rounded-full ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`}
            />
            <div
              className={`h-2 flex-1 rounded-full ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`}
            />
            <div
              className={`h-2 flex-1 rounded-full ${step >= 3 ? "bg-blue-600" : "bg-gray-200"}`}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t("auth.orLogin")}</span>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600">
            {t("auth.hasAccount")}{" "}
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
