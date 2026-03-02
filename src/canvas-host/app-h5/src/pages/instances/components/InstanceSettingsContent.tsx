/**
 * InstanceSettingsContent - 实例设置内容组件
 * 使用 Tab 切换不同设置部分
 */

import { Check, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import type { Instance } from "../../../services/api/tenant";
import { ThemeSwitcher } from "../../../components/ThemeSwitcher";
import { useThemeStyles } from "../../../hooks/useThemeStyles";

interface InstanceSettingsContentProps {
  instance: Instance;
  onRefresh: () => void;
}

type UserRole = "operator" | "node";
type TabType = "gateway" | "basic" | "other";

export function InstanceSettingsContent({ instance, onRefresh }: InstanceSettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>("gateway");
  const [name, setName] = useState(instance.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const styles = useThemeStyles();

  // WebSocket 连接配置
  const [wsUrl, setWsUrl] = useState("");
  const [authToken, setAuthToken] = useState(instance.gatewayToken || "");
  const [userRole, setUserRole] = useState<UserRole>("operator");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 从 localStorage 加载保存的配置
  useEffect(() => {
    const storageKey = `instance-${instance.instanceId}`;
    const savedConfig = localStorage.getItem(storageKey);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.wsUrl) {
          setWsUrl(config.wsUrl);
        }
        if (config.authToken) {
          setAuthToken(config.authToken);
        }
        if (config.userRole) {
          setUserRole(config.userRole);
        }
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    }

    // 根据实例类型生成默认 WebSocket URL
    if (!wsUrl) {
      if (instance.port) {
        const baseUrl =
          instance.customUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || `localhost`;
        setWsUrl(`ws://${baseUrl}:${instance.port}`);
      } else if (instance.url) {
        const url = new URL(instance.url);
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        setWsUrl(`${wsProtocol}//${url.host}`);
      }
    }
  }, [instance.instanceId, instance.port, instance.url, instance.customUrl, instance.gatewayToken]);

  // 保存配置到 localStorage
  const saveConfig = () => {
    const storageKey = `instance-${instance.instanceId}`;
    const config = {
      wsUrl,
      authToken,
      userRole,
    };
    localStorage.setItem(storageKey, JSON.stringify(config));
    // 触发自定义事件通知其他页面配置已更新
    window.dispatchEvent(
      new CustomEvent("instance-config-updated", { detail: { instanceId: instance.instanceId } }),
    );
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  // 连接 WebSocket
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      saveConfig();
      console.log("Connecting to:", wsUrl, "with token:", authToken ? "***" : "none");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsConnected(true);
    } catch (error) {
      console.error("连接失败:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  // 断开 WebSocket 连接
  const handleDisconnect = () => {
    console.log("Disconnecting from:", wsUrl);
    setIsConnected(false);
  };

  // 保存实例名称
  const handleSaveName = async () => {
    if (!name.trim() || name === instance.name) {
      return;
    }

    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onRefresh();
      }, 1500);
    } catch (error) {
      console.error("保存失败:", error);
    } finally {
      setSaving(false);
    }
  };

  // 获取实例类型文本
  const getInstanceTypeText = (source: Instance["source"]): string => {
    const typeMap = {
      managed: "托管实例",
      custom: "云实例",
      hardware: "硬件实例",
    };
    return typeMap[source] || source;
  };

  // 获取状态颜色
  const getStatusColor = () => {
    const colors = {
      running: "#10b981",
      stopped: "#94a3b8",
      starting: "#f59e0b",
      stopping: "#f59e0b",
      error: "var(--color-error)",
    };
    return colors[instance.status] || colors.stopped;
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN");
  };

  // Tab 配置
  const tabs: { key: TabType; label: string }[] = [
    { key: "gateway", label: "Gateway 连接" },
    { key: "basic", label: "基本信息" },
    { key: "other", label: "其他设置" },
  ];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Tab 切换 */}
      <div
        className="flex gap-3 p-2 rounded-xl"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-3 px-4 rounded-lg text-base font-semibold transition-all"
            style={{
              backgroundColor: activeTab === tab.key ? "var(--color-primary)" : "var(--color-card)",
              color: activeTab === tab.key ? "var(--color-text)" : "var(--color-text-secondary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div>
        {activeTab === "gateway" && (
          <div className="space-y-6">
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* 连接状态 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`}
                  />
                  <span className="text-sm">{isConnected ? "● 已连接" : "○ 未连接"}</span>
                </div>
                {isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--color-error)", color: "var(--color-text)" }}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting || !wsUrl.trim()}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-text)" }}
                  >
                    {isConnecting ? "连接中..." : "连接"}
                  </button>
                )}
              </div>

              {/* WebSocket 地址 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">WebSocket 地址</label>
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  placeholder="ws://192.168.1.100:18789"
                  disabled={isConnected}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: isConnected ? "var(--color-border)" : "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
                <p className="text-xs text-[var(--color-text-disabled)]">
                  格式: ws://IP:PORT 或 wss://域名:PORT
                </p>
              </div>

              {/* 认证 Token */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">
                  认证 Token（可选）
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Gateway Token（operator 模式推荐）"
                  disabled={isConnected}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: isConnected ? "var(--color-border)" : "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
                <p className="text-xs text-[var(--color-text-disabled)]">
                  Operator 模式建议提供 Token 以获取完整权限
                </p>
              </div>

              {/* 用户角色 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">客户端角色</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  disabled={isConnected}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: isConnected ? "var(--color-border)" : "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                >
                  <option value="operator">Operator（操作员）</option>
                  <option value="node">Node（节点客户端）</option>
                </select>
                <p className="text-xs text-[var(--color-text-disabled)]">
                  {userRole === "operator" ? "Operator: 可读写配置和状态" : "Node: 节点客户端角色"}
                </p>
              </div>

              {/* 保存配置按钮 */}
              <button
                onClick={saveConfig}
                disabled={isConnected}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: configSaved ? "var(--color-primary)" : "var(--color-card)",
                  color: configSaved ? "var(--color-text)" : "var(--color-text-tertiary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {configSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    已保存
                  </>
                ) : (
                  "保存配置"
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "basic" && (
          <div className="space-y-6">
            {/* 基本信息 */}
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* 实例名称 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">实例名称</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={instance.name}
                    className="flex-1"
                    style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      color: "var(--color-text)",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={!name.trim() || name === instance.name || saving}
                    className="px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-text)",
                      minWidth: "80px",
                    }}
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      "保存"
                    )}
                  </button>
                </div>
              </div>

              <div className="h-px" style={{ backgroundColor: "var(--color-card)" }} />

              {/* 实例 ID */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">实例 ID</label>
                <p
                  className="text-xs"
                  style={{
                    fontFamily: "monospace",
                    color: "var(--color-text-tertiary)",
                    wordBreak: "break-all",
                  }}
                >
                  {instance.instanceId}
                </p>
              </div>

              {/* 实例类型 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">实例类型</label>
                <p>{getInstanceTypeText(instance.source)}</p>
              </div>

              {/* 健康状态 */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-tertiary)]">健康状态</label>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor() }}
                  />
                  <span>{instance.isHealthy ? "在线" : "离线"}</span>
                </div>
              </div>

              {instance.lastHealthCheck && (
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-tertiary)]">最后检查</label>
                  <p className="text-sm text-[var(--color-text-disabled)]">
                    {formatDate(instance.lastHealthCheck)}
                  </p>
                </div>
              )}
            </div>

            {/* 连接信息 */}
            {(instance.url || instance.customUrl || instance.port) && (
              <div
                className="rounded-xl p-4 space-y-4"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h3 className="text-lg font-semibold">连接信息</h3>
                {instance.url && (
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--color-text-tertiary)]">访问地址</label>
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-primary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {instance.url}
                    </p>
                  </div>
                )}

                {instance.customUrl && (
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--color-text-tertiary)]">自定义地址</label>
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-primary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {instance.customUrl}
                    </p>
                  </div>
                )}

                {instance.port && (
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--color-text-tertiary)]">端口</label>
                    <p
                      className="text-sm"
                      style={{ fontFamily: "monospace", color: "var(--color-text)" }}
                    >
                      {instance.port}
                    </p>
                  </div>
                )}

                {instance.containerId && (
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--color-text-tertiary)]">容器 ID</label>
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-text-tertiary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {instance.containerId}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 时间信息 */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3 className="text-lg font-semibold">时间信息</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-tertiary)]">创建时间</span>
                <span className="text-sm text-[var(--color-text-disabled)]">
                  {formatDate(instance.createdAt)}
                </span>
              </div>
              <div className="h-px" style={{ backgroundColor: "var(--color-card)" }} />
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-tertiary)]">更新时间</span>
                <span className="text-sm text-[var(--color-text-disabled)]">
                  {formatDate(instance.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "other" && (
          <div className="space-y-6">
            {/* 界面设置 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: styles.text }}>
                界面设置
              </h3>
              <div className="rounded-xl p-4" style={{ ...styles.cardStyle, padding: "16px" }}>
                <ThemeSwitcher />
              </div>
            </div>

            {/* 危险操作 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#ef4444]">危险操作</h3>
              <div
                className="rounded-xl p-4 text-center space-y-4"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
                  <span className="text-[#ef4444]">删除此实例</span>
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  删除实例后，所有数据将永久丢失且无法恢复。
                </p>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除实例 "${instance.name}" 吗？`)) {
                      console.log("删除实例:", instance.instanceId);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: "var(--color-error)",
                    color: "var(--color-text)",
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  删除实例
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
