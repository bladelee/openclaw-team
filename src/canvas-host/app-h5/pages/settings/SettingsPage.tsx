/**
 * Settings 设置页面
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../utils/storage';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { gateway, theme, setTheme, setCurrentPage, updateGatewayConfig } = useApp();
  const [gatewayUrl, setGatewayUrl] = useState('ws://localhost:18789');
  const [authToken, setAuthToken] = useState('');
  const [userRole, setUserRole] = useState<'operator' | 'node'>('operator');
  const [isConnecting, setIsConnecting] = useState(false);
  const [saveConfig, setSaveConfig] = useState(false);

  useEffect(() => {
    if (gateway) {
      setGatewayUrl(gateway.getUrl());
    }
    // 从 storage 加载配置
    const token = storage.get<string | null>('gateway-token', null);
    const role = storage.get<'operator' | 'node'>('gateway-role', 'operator');
    if (token) setAuthToken(token);
    setUserRole(role);
  }, [gateway]);

  const handleConnect = () => {
    if (!gateway) {
      return;
    }

    setIsConnecting(true);
    try {
      gateway.setUrl(gatewayUrl);
      gateway.connect();
    } finally {
      setTimeout(() => setIsConnecting(false), 500);
    }
  };

  const handleDisconnect = () => {
    gateway?.disconnect();
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
  };

  const handleSaveConfig = () => {
    // 保存配置到 storage
    if (authToken) {
      storage.set('gateway-token', authToken);
    } else {
      storage.remove('gateway-token');
    }
    storage.set('gateway-role', userRole);

    // 立即更新 GatewayService 运行时配置
    updateGatewayConfig({
      token: authToken || undefined,
      role: userRole
    });

    setSaveConfig(true);
    setTimeout(() => setSaveConfig(false), 2000);
  };

  return (
    <div className="settings-page">
      {/* 头部 */}
      <header className="settings-header">
        <button className="back-button" onClick={() => setCurrentPage('chat')}>
          ← 返回
        </button>
        <h1>⚙️ 设置</h1>
        <div className="spacer"></div>
      </header>

      <div className="settings-content">
        {/* Gateway 连接状态 */}
        <section className="settings-section">
          <h2>🔌 Gateway 连接</h2>
          <div className="status-card">
            <div className={`status-indicator ${gateway?.isConnected ? 'connected' : 'disconnected'}`}>
              {gateway?.isConnected ? '● 已连接' : '○ 未连接'}
            </div>
            {gateway?.isConnected && (
              <div className="connection-details">
                <p>服务器: <code>localhost</code></p>
                <p>地址: <code>{gatewayUrl}</code></p>
              </div>
            )}
            <div className="action-buttons">
              {gateway?.isConnected ? (
                <button className="button button-danger" onClick={handleDisconnect}>
                  断开连接
                </button>
              ) : (
                <button
                  className="button button-primary"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? '连接中...' : '连接'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Gateway 配置 */}
        <section className="settings-section">
          <h2>🔧 连接配置</h2>
          <div className="config-card">
            <label htmlFor="gateway-url">Gateway 地址</label>
            <input
              id="gateway-url"
              type="text"
              className="input"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="ws://192.168.1.100:18789"
              disabled={gateway?.isConnected}
            />
            <p className="hint">格式: ws://IP:PORT 或 wss://域名:PORT</p>

            <label htmlFor="auth-token">认证 Token（可选）</label>
            <input
              id="auth-token"
              type="password"
              className="input"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Gateway Token（operator 模式推荐）"
              disabled={gateway?.isConnected}
            />
            <p className="hint">Operator 模式建议提供 Token 以获取完整权限</p>

            <label htmlFor="user-role">客户端角色</label>
            <select
              id="user-role"
              className="input"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as 'operator' | 'node')}
              disabled={gateway?.isConnected}
            >
              <option value="operator">Operator（操作员）</option>
              <option value="node">Node（节点客户端）</option>
            </select>
            <p className="hint">
              {userRole === 'operator' ? 'Operator: 可读写配置和状态' : 'Node: 节点客户端角色'}
            </p>

            <button
              className="button button-primary"
              onClick={handleSaveConfig}
              disabled={gateway?.isConnected || saveConfig}
              style={{ marginTop: '12px' }}
            >
              {saveConfig ? '✓ 已保存' : '保存配置'}
            </button>
            <p className="hint" style={{ marginTop: '8px' }}>
              保存后刷新页面或断开重连以应用新配置
            </p>
          </div>
        </section>

        {/* 主题设置 */}
        <section className="settings-section">
          <h2>🎨 外观</h2>
          <div className="theme-card">
            <label>主题模式</label>
            <div className="theme-options">
              <button
                className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                onClick={() => handleThemeChange('auto')}
              >
                ● 自动
              </button>
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                ◑ 浅色
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                ◐ 深色
              </button>
            </div>
          </div>
        </section>

        {/* 关于 */}
        <section className="settings-section">
          <h2>ℹ️ 关于</h2>
          <div className="about-card">
            <p><strong>版本:</strong> v1.0.0 (build 2025-02-04)</p>
            <p><strong>名称:</strong> OpenClaw H5 Client</p>
            <p className="hint">基于 A2UI React H5 的移动端应用</p>
          </div>
        </section>
      </div>
    </div>
  );
};
