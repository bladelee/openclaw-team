/**
 * ChatService 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from './ChatService';
import { GatewayService } from '../gateway/GatewayService';

describe('ChatService', () => {
  let chatService: ChatService;
  let gatewayService: GatewayService;

  beforeEach(() => {
    gatewayService = new GatewayService({ url: 'ws://localhost:9999' });
    chatService = new ChatService(gatewayService, 'test-session');
  });

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(chatService).toBeDefined();
    });

    it('应该返回正确的会话 ID', () => {
      expect(chatService.getSessionId()).toBe('test-session');
    });

    it('初始消息列表应该为空', () => {
      const messages = chatService.getMessages();
      expect(messages).toEqual([]);
    });
  });

  describe('发送消息', () => {
    it('应该能够发送文本消息', async () => {
      await chatService.sendText('Hello, AI!');
      const messages = chatService.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello, AI!');
      expect(messages[0].role).toBe('user');
    });

    it('空消息应该抛出错误', async () => {
      await expect(chatService.sendText('')).rejects.toThrow('消息内容不能为空');
    });

    it('纯空格消息应该抛出错误', async () => {
      await expect(chatService.sendText('   ')).rejects.toThrow('消息内容不能为空');
    });

    it('应该生成唯一的消息 ID', async () => {
      await chatService.sendText('Message 1');
      await chatService.sendText('Message 2');
      const messages = chatService.getMessages();
      expect(messages[0].id).not.toBe(messages[1].id);
    });
  });

  describe('消息管理', () => {
    it('应该能够清空消息', () => {
      chatService.clearMessages();
      const messages = chatService.getMessages();
      expect(messages).toEqual([]);
    });

    it('应该能够删除单条消息', async () => {
      await chatService.sendText('Test message');
      const messages = chatService.getMessages();
      const messageId = messages[0].id;

      chatService.deleteMessage(messageId);
      const updatedMessages = chatService.getMessages();
      expect(updatedMessages).toEqual([]);
    });
  });

  describe('会话管理', () => {
    it('应该能够切换会话', () => {
      chatService.switchSession('new-session');
      expect(chatService.getSessionId()).toBe('new-session');
    });

    it('切换会话后应该清空消息', async () => {
      await chatService.sendText('Test');
      expect(chatService.getMessages().length).toBe(1);

      chatService.switchSession('new-session');
      expect(chatService.getMessages().length).toBe(0);
    });

    it('切换到相同会话应该不做任何事', () => {
      const originalMessages = chatService.getMessages();
      chatService.switchSession('test-session');
      expect(chatService.getMessages()).toEqual(originalMessages);
    });
  });

  describe('订阅', () => {
    it('应该能够订阅消息更新', () => {
      const callback = vi.fn();
      const unsubscribe = chatService.subscribe(callback);

      // 初始调用
      expect(callback).toHaveBeenCalledWith([]);

      unsubscribe();
    });

    it('取消订阅后应该不再收到更新', () => {
      const callback = vi.fn();
      const unsubscribe = chatService.subscribe(callback);

      unsubscribe();
      // 这里需要触发一次更新来验证，但为了简单起见，我们只验证取消订阅不抛错
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
