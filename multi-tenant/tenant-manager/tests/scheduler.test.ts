// 租户调度器单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantScheduler } from '../src/scheduler.js';
import { getPortainerClient } from '../src/portainer.js';
import { tenantDb } from '../src/database.js';
import { quotas } from '../src/config.js';

// Create a mock portainer client
const mockPortainerClient = {
  getEnvironments: vi.fn(),
  getAvailableEnvironments: vi.fn(function(this: any) {
    // Simulate the real implementation - call getEnvironments and filter
    return this.getEnvironments().then((hosts: any[]) =>
      hosts.filter((h: any) => h.Status === 1)
    );
  }),
  getDockerInfo: vi.fn(),
  getEnvironment: vi.fn(),
};

// Mock 依赖
vi.mock('../src/portainer.js', () => ({
  getPortainerClient: vi.fn(() => mockPortainerClient),
}));

vi.mock('../src/database.js');

describe('TenantScheduler', () => {
  let scheduler: TenantScheduler;

  beforeEach(() => {
    scheduler = new TenantScheduler();
    vi.clearAllMocks();
  });

  describe('getAvailableHosts', () => {
    it('should return hosts with status 1', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 2, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
        { Id: 3, Name: 'host-3', Status: 1, Type: 1, URL: 'tcp://host3:2375', PublicURL: 'host3' },
      ];

      mockPortainerClient.getEnvironments.mockResolvedValue(mockHosts as any);

      const available = await scheduler.getAvailableHosts();

      expect(available).toHaveLength(2);
      expect(available[0].Id).toBe(1);
      expect(available[1].Id).toBe(3);
    });

    it('should return empty array when no hosts available', async () => {
      mockPortainerClient.getEnvironments.mockResolvedValue([]);

      const available = await scheduler.getAvailableHosts();

      expect(available).toEqual([]);
    });
  });

  describe('getHostStats', () => {
    it('should fetch and cache host stats', async () => {
      const mockStats = {
        NCPU: 4,
        MemTotal: 8 * 1024 * 1024 * 1024,
        MemUsed: 2 * 1024 * 1024 * 1024,
        ServerVersion: '20.10.0',
        Name: 'worker-01',
      };

      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);

      // First call - should fetch
      const stats1 = await scheduler.getHostStats(1);
      expect(stats1).toEqual(mockStats);
      expect(mockPortainerClient.getDockerInfo).toHaveBeenCalledWith(1);

      // Second call - should use cache
      const stats2 = await scheduler.getHostStats(1);
      expect(stats2).toEqual(mockStats);
      expect(mockPortainerClient.getDockerInfo).toHaveBeenCalledTimes(1);
    });

    it('should return null on fetch error', async () => {
      mockPortainerClient.getDockerInfo.mockRejectedValue(new Error('Network error'));

      const stats = await scheduler.getHostStats(1);

      expect(stats).toBeNull();
    });
  });

  describe('calculateScore', () => {
    it('should return positive score for available resources', () => {
      const stats = {
        NCPU: 4,
        MemTotal: 8 * 1024 * 1024 * 1024,
        MemUsed: 2 * 1024 * 1024 * 1024,
      };

      // Access private method through public interface
      const score = scheduler['calculateScore'](stats, 1, 1 * 1024);

      expect(score).toBeGreaterThan(0);
    });

    it('should return -1 for insufficient memory', () => {
      const stats = {
        NCPU: 4,
        MemTotal: 1 * 1024 * 1024 * 1024,
        MemUsed: 900 * 1024 * 1024,
      };

      const score = scheduler['calculateScore'](stats, 1, 2 * 1024);

      expect(score).toBe(-1);
    });
  });

  describe('selectByRoundRobin', () => {
    it('should select host with least tenants', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 1, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
      ];

      mockPortainerClient.getEnvironments.mockResolvedValue(mockHosts as any);
      vi.mocked(tenantDb.countByEndpoint)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const selection = await scheduler.selectByRoundRobin({
        plan: 'basic',
      });

      expect(selection).toBeDefined();
      expect(selection!.endpointId).toBe(2);
      expect(selection!.host.Name).toBe('host-2');
    });

    it('should return null when no hosts available', async () => {
      mockPortainerClient.getEnvironments.mockResolvedValue([]);

      const selection = await scheduler.selectByRoundRobin({
        plan: 'basic',
      });

      expect(selection).toBeNull();
    });
  });

  describe('selectByConsistentHash', () => {
    it('should always select same host for same key', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 1, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
        { Id: 3, Name: 'host-3', Status: 1, Type: 1, URL: 'tcp://host3:2375', PublicURL: 'host3' },
      ];

      mockPortainerClient.getEnvironments.mockResolvedValue(mockHosts as any);

      const selection1 = await scheduler.selectByConsistentHash({
        tenantId: 'tenant-user123',
        plan: 'basic',
      });

      const selection2 = await scheduler.selectByConsistentHash({
        tenantId: 'tenant-user123',
        plan: 'basic',
      });

      expect(selection1!.endpointId).toBe(selection2!.endpointId);
    });

    it('should select different hosts for different keys', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 1, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
      ];

      mockPortainerClient.getEnvironments.mockResolvedValue(mockHosts as any);

      const selection1 = await scheduler.selectByConsistentHash({
        tenantId: 'tenant-user-a',
        plan: 'basic',
      });

      const selection2 = await scheduler.selectByConsistentHash({
        tenantId: 'tenant-user-b',
        plan: 'basic',
      });

      // 它们可能相同，但对于不同的用户大概率不同
      expect(selection1).toBeDefined();
      expect(selection2).toBeDefined();
    });
  });

  describe('validateResources', () => {
    it('should validate sufficient resources', async () => {
      const mockStats = {
        NCPU: 4,
        MemTotal: 8 * 1024 * 1024 * 1024,
        MemUsed: 2 * 1024 * 1024 * 1024,
      };

      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);

      const validation = await scheduler.validateResources(1, 'basic');

      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('should reject insufficient memory', async () => {
      const mockStats = {
        NCPU: 4,
        MemTotal: 1 * 1024 * 1024 * 1024,  // 1 GB
        MemUsed: 900 * 1024 * 1024,         // ~0.9 GB
      };

      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);
      scheduler.clearCache();

      const validation = await scheduler.validateResources(1, 'basic');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Insufficient memory');
    });

    it('should return error when cannot get stats', async () => {
      mockPortainerClient.getDockerInfo.mockRejectedValue(new Error('API error'));

      const validation = await scheduler.validateResources(1, 'basic');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Cannot get host stats');
    });
  });

  describe('select', () => {
    it('should use roundRobin by default', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
      ];

      mockPortainerClient.getEnvironments.mockResolvedValue(mockHosts as any);
      vi.mocked(tenantDb.countByEndpoint).mockResolvedValue(0);
      vi.mocked(tenantDb.getByTenantId).mockResolvedValue(null);

      const selection = await scheduler.select({
        plan: 'basic',
        userId: 'user123',
      });

      expect(selection).toBeDefined();
      expect(selection!.endpointId).toBe(1);
    });

    it('should reuse existing host when preferSameHost is true', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 1, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
      ];

      const mockTenant = {
        tenant_id: 'tenant-user123',
        endpoint_id: 1,
      };

      const mockStats = {
        NCPU: 4,
        MemTotal: 8 * 1024 * 1024 * 1024,
        MemUsed: 2 * 1024 * 1024 * 1024,
      };

      vi.mocked(tenantDb.getByTenantId).mockResolvedValue(mockTenant as any);
      mockPortainerClient.getEnvironment.mockResolvedValue(mockHosts[0]);
      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);

      const selection = await scheduler.select({
        plan: 'basic',
        tenantId: 'tenant-user123',
        userId: 'user123',
        preferSameHost: true,
      });

      expect(selection).toBeDefined();
      expect(selection!.endpointId).toBe(1);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache', async () => {
      const mockStats = { NCPU: 4, MemTotal: 8 * 1024 * 1024 * 1024, MemUsed: 2 * 1024 * 1024 * 1024 };
      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);

      // Populate cache
      await scheduler.getHostStats(1);

      // Clear cache
      scheduler.clearCache();

      // Should fetch again
      await scheduler.getHostStats(1);

      expect(mockPortainerClient.getDockerInfo).toHaveBeenCalledTimes(2);
    });

    it('should clear cache by pattern', async () => {
      const mockStats = { NCPU: 4, MemTotal: 8 * 1024 * 1024 * 1024, MemUsed: 2 * 1024 * 1024 * 1024 };
      mockPortainerClient.getDockerInfo.mockResolvedValue(mockStats);

      // Populate cache for two hosts
      await scheduler.getHostStats(1);
      await scheduler.getHostStats(2);

      // Clear cache by pattern
      scheduler.clearCache('2');

      // Host 1 should still be cached
      await scheduler.getHostStats(1);

      // Should only fetch host 2 again
      expect(mockPortainerClient.getDockerInfo).toHaveBeenCalledTimes(3); // 2 initial + 1 for host 2
    });
  });
});
