import { ArrowLeft, Check } from "lucide-react";
// 创建实例页面
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../contexts/I18nContext";
import { getUser } from "../../lib/auth.js";
import * as tenantApi from "../../services/api/tenant.js";

type InstanceType = "managed" | "cloud" | "hardware";

export function CreateInstancePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [instanceType, setInstanceType] = useState<InstanceType>("managed");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"free" | "basic" | "pro" | "enterprise">("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom instance fields
  const [url, setUrl] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("18789");
  const [apiToken, setApiToken] = useState("");
  const [healthCheckUrl, setHealthCheckUrl] = useState("");
  const [healthCheckInterval, setHealthCheckInterval] = useState("60");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t("instances.nameRequired"));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 获取当前用户邮箱
      const user = await getUser();
      if (!user?.email) {
        setError(t("instances.notAuthenticated"));
        return;
      }

      if (instanceType === "managed") {
        // 创建托管实例
        const instance = await tenantApi.createInstance({
          name: name.trim(),
          plan,
          email: user.email,
        });
      } else {
        // 创建自定义实例（云实例或硬件实例）
        const instance = await tenantApi.createCustomInstance({
          name: name.trim(),
          instanceType: instanceType === "cloud" ? "cloud" : "hardware",
          url: instanceType === "cloud" ? url : undefined,
          ip: instanceType === "hardware" ? ip : undefined,
          port: parseInt(port),
          apiToken: apiToken || undefined,
          healthCheckUrl: healthCheckUrl || undefined,
          healthCheckInterval: parseInt(healthCheckInterval),
        });
      }

      // 创建成功，导航回实例列表
      navigate("/instances");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.failed");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const instanceTypes: Array<{
    value: InstanceType;
    labelKey: string;
    descriptionKey: string;
    color: string;
  }> = [
    {
      value: "managed",
      labelKey: "instances.typeManaged",
      descriptionKey: "instances.typeManagedDesc",
      color: "blue",
    },
    {
      value: "cloud",
      labelKey: "instances.typeCloud",
      descriptionKey: "instances.typeCloudDesc",
      color: "purple",
    },
    {
      value: "hardware",
      labelKey: "instances.typeHardware",
      descriptionKey: "instances.typeHardwareDesc",
      color: "green",
    },
  ];

  const plans: Array<{
    value: "free" | "basic" | "pro" | "enterprise";
    labelKey: string;
    descriptionKey: string;
    color: string;
  }> = [
    {
      value: "free",
      labelKey: "instances.planFree",
      descriptionKey: "instances.planFreeDesc",
      color: "gray",
    },
    {
      value: "basic",
      labelKey: "instances.planBasic",
      descriptionKey: "instances.planBasicDesc",
      color: "blue",
    },
    {
      value: "pro",
      labelKey: "instances.planPro",
      descriptionKey: "instances.planProDesc",
      color: "purple",
    },
    {
      value: "enterprise",
      labelKey: "instances.planEnterprise",
      descriptionKey: "instances.planEnterpriseDesc",
      color: "indigo",
    },
  ];

  return (
    <div className="create-instance-page px-4 py-4">
      {/* 标题栏 */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate("/instances")}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          aria-label={t("instances.backToList")}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold ml-2">{t("instances.create")}</h1>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 实例名称 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            {t("instances.name")}
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-instance"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            disabled={loading}
            autoFocus
          />
        </div>

        {/* 实例类型选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t("instances.instanceType")}
          </label>
          <div className="space-y-2">
            {instanceTypes.map((type) => {
              const isSelected = instanceType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setInstanceType(type.value)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all active:scale-[0.98] ${
                    isSelected
                      ? `border-${type.color}-500 bg-${type.color}-50`
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-left">
                    <div
                      className={`font-semibold ${isSelected ? `text-${type.color}-700` : "text-gray-900"}`}
                    >
                      {t(type.labelKey)}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{t(type.descriptionKey)}</div>
                  </div>
                  {isSelected && (
                    <div
                      className={`w-6 h-6 rounded-full bg-${type.color}-500 flex items-center justify-center`}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 托管实例：选择套餐 */}
        {instanceType === "managed" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t("instances.selectPlan")}
            </label>
            <div className="space-y-2">
              {plans.map((p) => {
                const isSelected = plan === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlan(p.value)}
                    disabled={loading}
                    className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all active:scale-[0.98] ${
                      isSelected
                        ? `border-${p.color}-500 bg-${p.color}-50`
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-left">
                      <div
                        className={`font-semibold ${isSelected ? `text-${p.color}-700` : "text-gray-900"}`}
                      >
                        {t(p.labelKey)}
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">{t(p.descriptionKey)}</div>
                    </div>
                    {isSelected && (
                      <div
                        className={`w-6 h-6 rounded-full bg-${p.color}-500 flex items-center justify-center`}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 云实例：URL */}
        {instanceType === "cloud" && (
          <>
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                {t("instances.url")}
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("instances.urlPlaceholder")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 mb-2">
                {t("instances.apiToken")}
              </label>
              <input
                type="text"
                id="apiToken"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={t("instances.apiTokenPlaceholder")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="healthCheckUrl"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t("instances.healthCheckUrl")}
              </label>
              <input
                type="url"
                id="healthCheckUrl"
                value={healthCheckUrl}
                onChange={(e) => setHealthCheckUrl(e.target.value)}
                placeholder={t("instances.healthCheckUrlPlaceholder")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="healthCheckInterval"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t("instances.healthCheckInterval")}
              </label>
              <input
                type="number"
                id="healthCheckInterval"
                value={healthCheckInterval}
                onChange={(e) => setHealthCheckInterval(e.target.value)}
                min="10"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>
          </>
        )}

        {/* 硬件实例：IP 和端口 */}
        {instanceType === "hardware" && (
          <>
            <div>
              <label htmlFor="ip" className="block text-sm font-medium text-gray-700 mb-2">
                {t("instances.ip")}
              </label>
              <input
                type="text"
                id="ip"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder={t("instances.ipPlaceholder")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="hwPort" className="block text-sm font-medium text-gray-700 mb-2">
                {t("instances.port")}
              </label>
              <input
                type="number"
                id="hwPort"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="hwApiToken" className="block text-sm font-medium text-gray-700 mb-2">
                {t("instances.apiToken")}
              </label>
              <input
                type="text"
                id="hwApiToken"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={t("instances.apiTokenPlaceholder")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>
          </>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              {t("instances.creating")}
            </span>
          ) : (
            t("instances.create")
          )}
        </button>
      </form>
    </div>
  );
}
