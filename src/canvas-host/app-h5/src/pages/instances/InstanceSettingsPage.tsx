/**
 * 实例设置页面 - 独立页面
 * 不再使用弹出框，而是全屏页面
 */

import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getInstance, type Instance } from "../../services/api/tenant";
import { InstanceSettingsContent } from "./components/InstanceSettingsContent";

export function InstanceSettingsPage() {
  const { instanceId } = useParams<{ instanceId: string }>();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  // 刷新实例
  const refreshInstance = async () => {
    await fetchInstance();
  };

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
          <p className="text-[var(--color-text-secondary)]">加载中...</p>
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
            <p className="text-[var(--color-text-secondary)]">{error}</p>
            <Link to={`/instances/${instanceId}`} className="block">
              <button
                className="w-full px-4 py-3 rounded-lg font-medium"
                style={{ backgroundColor: "var(--color-primary)", color: "#ffffff" }}
              >
                返回
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
          className="rounded-xl p-6 text-center"
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-lg font-semibold text-[var(--color-text)]">实例不存在</p>
          <Link to={`/instances/${instanceId}`} className="block">
            <button
              className="px-6 py-3 rounded-lg font-medium mt-4"
              style={{ backgroundColor: "var(--color-primary)", color: "#ffffff" }}
            >
              返回
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* 顶部导航栏 */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* 返回按钮 */}
        <Link
          to={`/instances/${instanceId}`}
          className="p-2 rounded-lg hover:bg-[var(--color-card)] transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--color-text)" }} />
        </Link>

        {/* 标题 */}
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
            实例设置
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            {instance.name}
          </p>
        </div>

        {/* 占位，保持标题居中 */}
        <div style={{ width: "40px" }}></div>
      </header>

      {/* 设置内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto">
        <InstanceSettingsContent instance={instance} onRefresh={refreshInstance} />
      </div>
    </div>
  );
}
