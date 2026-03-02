/**
 * 实例详情页面 - 融合 Chat + Settings + Info
 * 使用 A2UI 深色主题设计规范
 * 颜色系统：
 *   - 背景: #071016 (深蓝黑)
 *   - 表面: #0f1720 (深色)
 *   - 卡片: #1e293b (深灰)
 *   - 主色: var(--color-primary) (青色)
 *   - 边框: #1e293b / #334155
 *   - 文字: #ffffff (主), #94a3b8 (次), #64748b (辅)
 */

import {
  ArrowLeft,
  Settings as SettingsIcon,
  MoreHorizontal,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Server,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useI18n } from "../../contexts/I18nContext";
import {
  getInstance,
  startInstance,
  stopInstance,
  deleteInstance,
  type Instance,
} from "../../services/api/tenant";
// 导入子组件
import { InstanceChat } from "./components/InstanceChat";
import { InstanceInfo } from "./components/InstanceInfo";

type ViewMode = "chat" | "settings" | "info";

export function InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  console.debug(
    "[InstanceDetailPage] Component mounted, instanceId:",
    instanceId,
    "viewMode:",
    viewMode,
  );

  // 获取实例详情
  const fetchInstance = async () => {
    if (!instanceId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getInstance(instanceId);
      setInstance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instances.error"));
    } finally {
      setLoading(false);
    }
  };

  // 刷新实例状态
  const refreshInstance = async () => {
    await fetchInstance();
  };

  // 启动实例
  const handleStart = async () => {
    if (!instanceId) {
      return;
    }
    setActionLoading("start");
    try {
      await startInstance(instanceId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await refreshInstance();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instances.startError"));
    } finally {
      setActionLoading(null);
    }
  };

  // 停止实例
  const handleStop = async () => {
    if (!instanceId) {
      return;
    }
    setActionLoading("stop");
    try {
      await stopInstance(instanceId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await refreshInstance();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instances.stopError"));
    } finally {
      setActionLoading(null);
    }
  };

  // 删除实例
  const handleDelete = async () => {
    if (!instanceId) {
      return;
    }
    if (!confirm(t("instances.confirmDelete"))) {
      return;
    }

    setActionLoading("delete");
    try {
      await deleteInstance(instanceId);
      navigate("/instances");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instances.deleteError"));
    } finally {
      setActionLoading(null);
    }
  };

  // 切换视图
  const switchView = (view: ViewMode) => {
    setViewMode(view);
    setMoreMenuOpen(false);
  };

  // 初始加载
  useEffect(() => {
    fetchInstance();
  }, [instanceId]);

  // 加载状态
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[#94a3b8]">{t("instances.loading")}</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div
        className="flex items-center justify-center h-screen p-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div
          className="rounded-xl p-6"
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="space-y-4">
            <p className="text-[var(--color-error)] font-semibold text-lg">错误</p>
            <p className="text-[#94a3b8]">{error}</p>
            <button
              onClick={refreshInstance}
              disabled={loading}
              className="w-full px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            >
              {t("instances.retry")}
            </button>
            <Link to="/instances">
              <button className="w-full px-4 py-3 bg-[#1e293b] text-white rounded-lg font-medium active:scale-[0.98] transition-transform">
                {t("instances.backToList")}
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 实例不存在
  if (!instance) {
    return (
      <div
        className="flex items-center justify-center h-screen p-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div
          className="rounded-xl p-6"
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="text-center space-y-4">
            <Server className="w-16 h-16 mx-auto text-[#94a3b8]" />
            <p className="text-lg font-semibold text-white">实例不存在</p>
            <p className="text-[#94a3b8]">未找到该实例</p>
            <Link to="/instances">
              <button className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium">
                {t("instances.backToList")}
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 获取状态显示
  const getStatusDisplay = () => {
    const statusConfig = {
      running: { color: "var(--color-success)", text: t("status.running"), icon: "●" },
      stopped: { color: "var(--color-text-tertiary)", text: t("status.stopped"), icon: "○" },
      starting: { color: "var(--color-warning)", text: t("status.starting"), icon: "◎" },
      stopping: { color: "var(--color-warning)", text: t("status.stopping"), icon: "◎" },
      error: { color: "var(--color-error)", text: t("status.error"), icon: "●" },
    };

    const config = statusConfig[instance.status] || statusConfig.stopped;
    return config;
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: "var(--color-background)", color: "var(--color-text)" }}
    >
      {/* 顶部导航栏 - A2UI 深色主题 */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* 左侧：返回按钮 + 实例名称 */}
        <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
          <Link to="/instances" className="text-[#94a3b8] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate m-0">{instance.name}</h1>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusDisplay.color }}
              />
            </div>
            <p className="text-sm text-[#94a3b8] truncate">{statusDisplay.text}</p>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 刷新按钮 */}
          <button
            onClick={refreshInstance}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={t("instances.refresh")}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* 设置按钮 */}
          <Link
            to={`/instances/${instanceId}/settings`}
            className="p-2 rounded-lg hover:bg-[var(--color-card)] transition-colors"
            aria-label="设置"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>

          {/* 更多菜单 */}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-2 rounded-lg hover:bg-[#1e293b] transition-colors"
              aria-label="更多"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-2 z-50 rounded-lg shadow-lg"
                  style={{
                    minWidth: 180,
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => switchView("chat")}
                      className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition-colors flex items-center gap-2"
                    >
                      💬 {t("instances.chat")}
                    </button>
                    <Link
                      to={`/instances/${instanceId}/settings`}
                      onClick={() => setMoreMenuOpen(false)}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--color-card)] transition-colors flex items-center gap-2"
                    >
                      ⚙️ {t("instances.settings")}
                    </Link>
                    <button
                      onClick={() => switchView("info")}
                      className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition-colors flex items-center gap-2"
                    >
                      ℹ️ {t("instances.info")}
                    </button>
                    <div className="h-px my-1" style={{ backgroundColor: "var(--color-card)" }} />
                    <Link
                      to={`/instances/${instanceId}/chat-old`}
                      onClick={() => setMoreMenuOpen(false)}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--color-card)] transition-colors flex items-center gap-2 text-yellow-500"
                    >
                      🧪 旧版聊天（测试）
                    </Link>
                    <div className="h-px my-1" style={{ backgroundColor: "var(--color-card)" }} />
                    {instance.status === "running" ? (
                      <button
                        onClick={handleStop}
                        disabled={actionLoading !== null}
                        className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition-colors flex items-center gap-2 text-[var(--color-error)] disabled:opacity-50"
                      >
                        <Square className="w-4 h-4" />
                        {t("instances.stop")}
                      </button>
                    ) : (
                      <button
                        onClick={handleStart}
                        disabled={actionLoading !== null}
                        className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition-colors flex items-center gap-2 text-[var(--color-success)] disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        {t("instances.start")}
                      </button>
                    )}
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading !== null}
                      className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition-colors flex items-center gap-2 text-[var(--color-error)] disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("instances.delete")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 - Chat 优先 */}
      <main className="flex-1 overflow-hidden">
        {console.debug(
          "[InstanceDetailPage] Rendering main, viewMode:",
          viewMode,
          "instance:",
          instance?.name,
        )}
        {viewMode === "chat" && instance ? (
          <>
            {console.debug(
              "[InstanceDetailPage] Condition met, rendering InstanceChat for",
              instance.name,
            )}
            <InstanceChat key={location.key} instance={instance} />
          </>
        ) : (
          console.debug(
            "[InstanceDetailPage] Condition NOT met, viewMode:",
            viewMode,
            "hasInstance:",
            !!instance,
          )
        )}
        {viewMode === "info" && <InstanceInfo instance={instance} />}
      </main>
    </div>
  );
}
