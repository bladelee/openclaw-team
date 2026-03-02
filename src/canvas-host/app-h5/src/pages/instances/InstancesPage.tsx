import { Play, Square, Trash2, Plus, RefreshCw, Server } from "lucide-react";
// 实例列表页面
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Instance } from "../../services/api/tenant.js";
import { useI18n } from "../../contexts/I18nContext";
import * as tenantApi from "../../services/api/tenant.js";

export function InstancesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // 加载实例列表
  const loadInstances = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantApi.getInstances();
      setInstances(data);
    } catch (err) {
      if (err instanceof tenantApi.APIError) {
        if (err.status === 401) {
          // 未授权，重定向到登录页
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message);
      } else {
        setError(t("instances.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  // 刷新实例列表（不显示加载状态）
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await tenantApi.getInstances();
      setInstances(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("instances.error");
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  // 启动实例
  const handleStart = async (id: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError(null);
      await tenantApi.startInstance(id);
      // 更新实例状态
      setInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === id ? { ...inst, status: "starting" as const } : inst,
        ),
      );
      // 延迟重新加载，让状态有时间更新
      setTimeout(() => loadInstances(), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("instances.startError");
      setError(message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // 停止实例
  const handleStop = async (id: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError(null);
      await tenantApi.stopInstance(id);
      // 更新实例状态
      setInstances((prev) =>
        prev.map((inst) =>
          inst.instanceId === id ? { ...inst, status: "stopping" as const } : inst,
        ),
      );
      // 延迟重新加载
      setTimeout(() => loadInstances(), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("instances.stopError");
      setError(message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // 删除实例
  const handleDelete = async (id: string) => {
    if (!confirm(t("instances.confirmDelete"))) {
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError(null);
      await tenantApi.deleteInstance(id);
      // 从列表中移除
      setInstances((prev) => prev.filter((inst) => inst.instanceId !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("instances.deleteError");
      setError(message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // 初始加载
  useEffect(() => {
    loadInstances();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t("instances.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="instances-page px-4 py-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("instances.title")}</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          aria-label={t("instances.refresh")}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 错误提示 - 移动端优化 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <div className="flex items-start justify-between">
            <p className="text-sm text-red-800 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 实例列表 - 移动端卡片优化 */}
      {instances.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-6">
            <Server className="w-16 h-16 mx-auto text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("instances.empty")}</h2>
          <p className="text-gray-600 mb-6">{t("instances.createFirst")}</p>
          <button
            onClick={() => navigate("/instances/new")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
            {t("instances.create")}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-20">
            {instances.map((instance) => (
              <Link
                key={instance.instanceId}
                to={`/instances/${instance.instanceId}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {instance.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          instance.status === "running"
                            ? "bg-green-100 text-green-800"
                            : instance.status === "stopped"
                              ? "bg-gray-100 text-gray-800"
                              : instance.status === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {instance.status === "running"
                          ? t("status.running")
                          : instance.status === "stopped"
                            ? t("status.stopped")
                            : instance.status === "error"
                              ? t("status.error")
                              : instance.status === "starting"
                                ? t("status.starting")
                                : t("status.stopping")}
                      </span>
                      {instance.port && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-600">
                            {t("instances.port")} {instance.port}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作按钮 - 移动端优化 */}
                <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                  {instance.status === "running" || instance.status === "starting" ? (
                    <button
                      onClick={() => handleStop(instance.instanceId)}
                      disabled={
                        actionLoading[instance.instanceId] || instance.status === "stopping"
                      }
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                    >
                      <Square className="w-4 h-4" />
                      {t("instances.stop")}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(instance.instanceId)}
                      disabled={actionLoading[instance.instanceId]}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      {t("instances.start")}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(instance.instanceId)}
                    disabled={actionLoading[instance.instanceId]}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                    aria-label={t("instances.delete")}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>

          {/* 浮动创建按钮 - FAB */}
          <button
            onClick={() => navigate("/instances/new")}
            className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-transform"
            aria-label={t("instances.create")}
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}
