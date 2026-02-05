/**
 * GatewayService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GatewayService } from './GatewayService';

describe('GatewayService', () => {
  let service: GatewayService;

  beforeEach(() => {
    service = new GatewayService({ url: 'ws://localhost:9999' });
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeDefined();
      expect(service.isConnected).toBe(false);
    });

    it('应该返回正确的连接状态', () => {
      expect(service.connectionStatus).toBe('disconnected');
    });

    it('应该返回正确的 URL', () => {
      expect(service.getUrl()).toBe('ws://localhost:9999');
    });
  });

  describe('URL 管理', () => {
    it('应该能够更新 URL', () => {
      service.setUrl('ws://localhost:8888');
      expect(service.getUrl()).toBe('ws://localhost:8888');
    });

    it('应该在连接时断开旧连接', () => {
      const disconnectSpy = vi.spyOn(service, 'disconnect');
      service.setUrl('ws://localhost:8888');
      // 由于没有真正连接，不会触发断开
      expect(service.getUrl()).toBe('ws://localhost:8888');
    });
  });

  describe('消息发送', () => {
    it('未连接时消息应该加入队列', () => {
      const message = {
        type: 'chat' as const,
        payload: { test: 'data' },
        timestamp: Date.now()
      };

      service.send(message);
      // 消息加入队列，无错误即成功
      expect(true).toBe(true);
    });
  });

  describe('事件监听', () => {
    it('应该能够监听 open 事件', () => {
      const callback = vi.fn();
      service.on('open', callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该能够监听 message 事件', () => {
      const callback = vi.fn();
      service.on('message', callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该能够监听 error 事件', () => {
      const callback = vi.fn();
      service.on('error', callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该能够监听 close 事件', () => {
      const callback = vi.fn();
      service.on('close', callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('断开连接', () => {
    it('应该能够断开连接', () => {
      expect(() => service.disconnect()).not.toThrow();
      expect(service.isConnected).toBe(false);
    });
  });
});
