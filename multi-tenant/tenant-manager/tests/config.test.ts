// 配置模块单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import { config, quotas, getQuota } from '../src/config.js';

describe('Config', () => {
  describe('环境变量解析', () => {
    it('应该有默认值', () => {
      expect(config.NODE_ENV).toBeDefined();
      expect(config.PORT).toBeDefined();
      expect(config.LOG_LEVEL).toBeDefined();
    });

    it('应该正确解析数字类型', () => {
      expect(config.PORT).toBe(3000);
      expect(config.METRICS_PORT).toBe(9090);
    });

    it('应该正确解析布尔类型', () => {
      expect(config.METRICS_ENABLED).toBe(true);
      expect(config.ALERT_ENABLED).toBe(false);
    });
  });

  describe('资源配额解析', () => {
    describe('parseQuotaString', () => {
      it('应该正确解析 free 配额', () => {
        expect(quotas.free.cpu).toBe(0.5);
        expect(quotas.free.memory).toBe(512);
        expect(quotas.free.storage).toBe(5120);
        expect(quotas.free.sandboxes).toBe(1);
      });

      it('应该正确解析 basic 配额', () => {
        expect(quotas.basic.cpu).toBe(1);
        expect(quotas.basic.memory).toBe(1024);
        expect(quotas.basic.storage).toBe(20480);
        expect(quotas.basic.sandboxes).toBe(3);
      });

      it('应该正确解析 pro 配额', () => {
        expect(quotas.pro.cpu).toBe(2);
        expect(quotas.pro.memory).toBe(2048);
        expect(quotas.pro.storage).toBe(51200);
        expect(quotas.pro.sandboxes).toBe(10);
      });

      it('应该正确解析 enterprise 配额', () => {
        expect(quotas.enterprise.cpu).toBe(4);
        expect(quotas.enterprise.memory).toBe(4096);
        expect(quotas.enterprise.storage).toBe(204800);
        expect(quotas.enterprise.sandboxes).toBe(-1); // -1 = 无限制
      });
    });

    describe('getQuota', () => {
      it('应该返回对应计划的配额', () => {
        const free = getQuota('free');
        expect(free.cpu).toBe(0.5);

        const basic = getQuota('basic');
        expect(basic.cpu).toBe(1);

        const pro = getQuota('pro');
        expect(pro.cpu).toBe(2);

        const enterprise = getQuota('enterprise');
        expect(enterprise.cpu).toBe(4);
      });

      it('应该对未知计划返回 basic 配额', () => {
        const unknown = getQuota('unknown' as any);
        expect(unknown.cpu).toBe(1); // basic 的默认值
      });

      it('应该返回独立对象（不修改原配额）', () => {
        const quota1 = getQuota('basic');
        const quota2 = getQuota('basic');

        expect(quota1).toEqual(quota2);
        expect(quota1).not.toBe(quota2);
      });
    });
  });

  describe('配额验证', () => {
    it('所有配额应该有正数的 CPU', () => {
      expect(quotas.free.cpu).toBeGreaterThan(0);
      expect(quotas.basic.cpu).toBeGreaterThan(0);
      expect(quotas.pro.cpu).toBeGreaterThan(0);
      expect(quotas.enterprise.cpu).toBeGreaterThan(0);
    });

    it('所有配额应该有正数的内存', () => {
      expect(quotas.free.memory).toBeGreaterThan(0);
      expect(quotas.basic.memory).toBeGreaterThan(0);
      expect(quotas.pro.memory).toBeGreaterThan(0);
      expect(quotas.enterprise.memory).toBeGreaterThan(0);
    });

    it('所有配额应该有正数的存储', () => {
      expect(quotas.free.storage).toBeGreaterThan(0);
      expect(quotas.basic.storage).toBeGreaterThan(0);
      expect(quotas.pro.storage).toBeGreaterThan(0);
      expect(quotas.enterprise.storage).toBeGreaterThan(0);
    });

    it('沙盒数应该是正数或 -1（无限制）', () => {
      expect(quotas.free.sandboxes).toBeGreaterThan(0);
      expect(quotas.basic.sandboxes).toBeGreaterThan(0);
      expect(quotas.pro.sandboxes).toBeGreaterThan(0);
      expect(quotas.enterprise.sandboxes).toBe(-1);
    });

    it('配额应该按计划递增', () => {
      expect(quotas.free.cpu).toBeLessThan(quotas.basic.cpu);
      expect(quotas.basic.cpu).toBeLessThan(quotas.pro.cpu);
      expect(quotas.pro.cpu).toBeLessThan(quotas.enterprise.cpu);

      expect(quotas.free.memory).toBeLessThan(quotas.basic.memory);
      expect(quotas.basic.memory).toBeLessThan(quotas.pro.memory);
      expect(quotas.pro.memory).toBeLessThan(quotas.enterprise.memory);
    });
  });
});
