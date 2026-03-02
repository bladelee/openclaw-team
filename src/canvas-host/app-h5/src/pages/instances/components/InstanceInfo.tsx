/**
 * InstanceInfo - 实例信息显示组件
 * 使用 A2UI 深色主题颜色
 */

import { Copy, ExternalLink, Server, Calendar, Activity, Shield, Database } from "lucide-react";
import type { Instance } from "../../../services/api/tenant";

interface InstanceInfoProps {
  instance: Instance;
}

export function InstanceInfo({ instance }: InstanceInfoProps) {
  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 获取实例类型文本
  const getInstanceTypeText = (source: Instance["source"]): string => {
    const typeMap = {
      managed: "托管实例 (由我们管理)",
      custom: "云实例 (外部云服务)",
      hardware: "硬件实例 (本地设备)",
    };
    return typeMap[source] || source;
  };

  // 获取实例类型图标
  const getInstanceTypeIcon = (source: Instance["source"]) => {
    switch (source) {
      case "managed":
        return "🌐";
      case "custom":
        return "☁️";
      case "hardware":
        return "🔧";
      default:
        return "📦";
    }
  };

  // 获取状态显示
  const getStatusDisplay = () => {
    const statusConfig = {
      running: { color: "var(--color-success)", text: "运行中" },
      stopped: { color: "var(--color-text-tertiary)", text: "已停止" },
      starting: { color: "var(--color-warning)", text: "启动中" },
      stopping: { color: "var(--color-warning)", text: "停止中" },
      error: { color: "var(--color-error)", text: "错误" },
    };

    return statusConfig[instance.status] || statusConfig.stopped;
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-6">
        {/* 实例概览 */}
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl">{getInstanceTypeIcon(instance.source)}</span>
            <div style={{ flex: 1 }}>
              <p className="text-lg font-semibold m-0">{instance.name}</p>
              <p className="text-sm text-[#94a3b8] m-0">{getInstanceTypeText(instance.source)}</p>
            </div>
          </div>
          <div className="h-px mb-4" style={{ backgroundColor: "var(--color-card)" }} />
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: statusDisplay.color }} />
            <span style={{ color: statusDisplay.color }}>{statusDisplay.text}</span>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#94a3b8]" />
            <h3 className="text-lg font-semibold">基本信息</h3>
          </div>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <InfoRow label="实例 ID" value={instance.instanceId} monospace />
            <InfoRow label="用户 ID" value={instance.userId} monospace />
            <InfoRow label="邮箱" value={instance.email} />
            {instance.containerId && (
              <InfoRow label="容器 ID" value={instance.containerId} monospace />
            )}
            {instance.containerName && <InfoRow label="容器名称" value={instance.containerName} />}
            {instance.port && <InfoRow label="端口" value={instance.port.toString()} />}
          </div>
        </div>

        {/* 连接信息 */}
        {(instance.url || instance.customUrl) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-[#94a3b8]" />
              <h3 className="text-lg font-semibold">连接信息</h3>
            </div>
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {instance.url && (
                <div className="space-y-2">
                  <label className="text-sm text-[#94a3b8]">访问地址</label>
                  <div className="flex gap-2 items-center">
                    <p
                      className="text-xs flex-1"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-primary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {instance.url}
                    </p>
                    <button
                      onClick={() => copyToClipboard(instance.url!)}
                      className="p-2 rounded hover:bg-[#1e293b] transition-colors"
                      aria-label="复制"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(instance.url, "_blank")}
                      className="p-2 rounded hover:bg-[#1e293b] transition-colors"
                      aria-label="打开"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {instance.customUrl && (
                <div className="space-y-2">
                  <label className="text-sm text-[#94a3b8]">自定义地址</label>
                  <div className="flex gap-2 items-center">
                    <p
                      className="text-xs flex-1"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-primary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {instance.customUrl}
                    </p>
                    <button
                      onClick={() => copyToClipboard(instance.customUrl!)}
                      className="p-2 rounded hover:bg-[#1e293b] transition-colors"
                      aria-label="复制"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {instance.healthCheckUrl && (
                <div className="space-y-2">
                  <label className="text-sm text-[#94a3b8]">健康检查地址</label>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "monospace",
                      color: "var(--color-text-tertiary)",
                      wordBreak: "break-all",
                    }}
                  >
                    {instance.healthCheckUrl}
                  </p>
                  {instance.healthCheckInterval && (
                    <p className="text-sm text-[#64748b]">
                      检查间隔: {instance.healthCheckInterval} 秒
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 健康状态 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#94a3b8]" />
            <h3 className="text-lg font-semibold">健康状态</h3>
          </div>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#94a3b8]">当前状态</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: instance.isHealthy
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                />
                <span>{instance.isHealthy ? "在线" : "离线"}</span>
              </div>
            </div>
            {instance.lastHealthCheck && (
              <>
                <div className="h-px" style={{ backgroundColor: "var(--color-card)" }} />
                <div className="flex justify-between">
                  <span className="text-sm text-[#94a3b8]">最后检查</span>
                  <span className="text-sm text-[#64748b]">
                    {formatDate(instance.lastHealthCheck)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 时间信息 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#94a3b8]" />
            <h3 className="text-lg font-semibold">时间信息</h3>
          </div>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex justify-between">
              <span className="text-sm text-[#94a3b8]">创建时间</span>
              <span
                className="text-sm"
                style={{ fontFamily: "monospace", color: "var(--color-text-disabled)" }}
              >
                {formatDate(instance.createdAt)}
              </span>
            </div>
            <div className="h-px" style={{ backgroundColor: "var(--color-card)" }} />
            <div className="flex justify-between">
              <span className="text-sm text-[#94a3b8]">更新时间</span>
              <span
                className="text-sm"
                style={{ fontFamily: "monospace", color: "var(--color-text-disabled)" }}
              >
                {formatDate(instance.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* 其他信息 */}
        {instance.plan && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#94a3b8]" />
              <h3 className="text-lg font-semibold">订阅计划</h3>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">当前计划</span>
                <span
                  style={{
                    textTransform: "capitalize",
                    color: "var(--color-primary)",
                    fontWeight: 600,
                  }}
                >
                  {instance.plan}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Token 信息（脱敏） */}
        {instance.gatewayToken && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#94a3b8]" />
              <h3 className="text-lg font-semibold">认证信息</h3>
            </div>
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="space-y-2">
                <label className="text-sm text-[#94a3b8]">Gateway Token</label>
                <div className="flex gap-2 items-center">
                  <span
                    className="flex-1 text-xs"
                    style={{ fontFamily: "monospace", color: "var(--color-text-tertiary)" }}
                  >
                    {instance.gatewayToken.substring(0, 8)}...
                  </span>
                  <button
                    onClick={() => copyToClipboard(instance.gatewayToken!)}
                    className="p-2 rounded hover:bg-[#1e293b] transition-colors"
                    aria-label="复制"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 信息行组件
interface InfoRowProps {
  label: string;
  value: string | number | null | undefined;
  monospace?: boolean;
}

function InfoRow({ label, value, monospace = false }: InfoRowProps) {
  if (value === null || value === undefined) {
    return null;
  }

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#94a3b8]">{label}</span>
      <span
        className="text-sm"
        style={{
          fontFamily: monospace ? "monospace" : "inherit",
          color: monospace ? "#94a3b8" : "#ffffff",
          wordBreak: "break-all",
          textAlign: "right",
          flex: 1,
          marginLeft: 16,
        }}
      >
        {value}
      </span>
    </div>
  );
}
