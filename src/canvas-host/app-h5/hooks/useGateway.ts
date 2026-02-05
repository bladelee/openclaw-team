/**
 * useGateway Hook
 * 用于管理 Gateway 连接
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayService, ConnectionStatus } from '../services/gateway';

interface UseGatewayOptions {
  autoConnect?: boolean;
  url?: string;
}

export function useGateway(options: UseGatewayOptions = {}) {
  const { autoConnect = true, url = 'ws://localhost:18789' } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  // 使用 ref 保存 GatewayService 实例，避免重复创建
  const gatewayRef = useRef<GatewayService | null>(null);

  // 初始化 GatewayService
  useEffect(() => {
    if (!gatewayRef.current) {
      gatewayRef.current = new GatewayService({ url });

      // 监听状态变化
      gatewayRef.current.on('open', () => {
        setIsConnected(true);
      });

      gatewayRef.current.on('close', () => {
        setIsConnected(false);
      });

      gatewayRef.current.on('statusChange', (newStatus: ConnectionStatus) => {
        setStatus(newStatus);
      });
    }

    return () => {
      // 组件卸载时断开连接
      if (gatewayRef.current) {
        gatewayRef.current.disconnect();
      }
    };
  }, [url]);

  // 自动连接
  useEffect(() => {
    if (autoConnect && gatewayRef.current) {
      gatewayRef.current.connect();
    }
  }, [autoConnect]);

  const connect = useCallback(() => {
    gatewayRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    gatewayRef.current?.disconnect();
  }, []);

  const send = useCallback((message: unknown) => {
    gatewayRef.current?.send(message);
  }, []);

  return {
    gateway: gatewayRef.current,
    status,
    isConnected,
    connect,
    disconnect,
    send
  };
}
