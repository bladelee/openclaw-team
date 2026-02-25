// 租户服务单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from '../src/tenant-service.js';
import { getPortainerClient } from '../src/portainer.js';
import { tenantDb } from '../src/database.js';
import { getScheduler } from '../src/scheduler.js';
import type { HostSelection } from '../src/scheduler.js';

// Create mock portainer client
const mockPortainerClient = {
  getEnvironments: vi.fn(),
  getAvailableEnvironments: vi.fn(function(this: any) {
    return this.getEnvironments().then((hosts: any[]) =>
      hosts.filter((h: any) => h.Status === 1)
    );
  }),
  getDockerInfo: vi.fn(),
  getEnvironment: vi.fn(),
  getContainer: vi.fn(),
  createContainer: vi.fn(),
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  removeContainer: vi.fn(),
  restartContainer: vi.fn(),
  clearCache: vi.fn(),
};

// Create mock scheduler
const mockScheduler = {
  select: vi.fn(),
  validateResources: vi.fn(),
  clearCache: vi.fn(),
};

// Mock 依赖
vi.mock('../src/portainer.js', () => ({
  getPortainerClient: vi.fn(() => mockPortainerClient),
}));

vi.mock('../src/database.js');

vi.mock('../src/scheduler.js', () => ({
  getScheduler: vi.fn(() => mockScheduler),
}));

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    service = new TenantService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create tenant successfully', async () => {
      // Mock 数据
      const mockHost: HostSelection = {
        endpointId: 1,
        host: {
          Id: 1,
          Name: 'worker-01',
          Status: 1,
          Type: 1,
          URL: 'tcp://192.168.1.10:2376',
          PublicURL: '192.168.1.10',
        },
        score: 100,
      };

      // Mock 返回值
      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      mockScheduler.select.mockResolvedValue(mockHost);
      mockScheduler.validateResources.mockResolvedValue({ valid: true });
      mockPortainerClient.createContainer.mockResolvedValue({
        Id: 'container-abc123',
        Warnings: [],
      });
      mockPortainerClient.startContainer.mockResolvedValue(undefined);
      mockPortainerClient.getContainer.mockResolvedValue({
        Id: 'container-abc123',
        Name: 'tenant-user123',
        State: { Running: true, Status: 'running' },
        NetworkSettings: {
          Ports: {
            '18789/tcp': [{ HostPort: '18789' }],
          },
        },
        Config: { Labels: {} },
      });
      vi.mocked(tenantDb.create).mockResolvedValue({
        id: 1,
        tenant_id: 'tenant-user123',
        user_id: 'user123',
        email: 'user@example.com',
        plan: 'basic',
        container_id: 'container-abc123',
        endpoint_id: 1,
        gateway_token: expect.any(String),
        status: 'running',
        port: 18789,
      });

      const result = await service.create({
        userId: 'user123',
        email: 'user@example.com',
      });

      expect(result).toBeDefined();
      expect(result.tenantId).toBe('tenant-user123');
      expect(result.status).toBe('running');
    });

    it('should throw error if user already has a tenant', async () => {
      const existingTenant = {
        tenant_id: 'tenant-existing',
        user_id: 'user123',
        email: 'user@example.com',
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(existingTenant as any);

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('already has a tenant');
    });

    it('should throw error if no available host', async () => {
      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      mockScheduler.select.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('No available host');
    });

    it('should throw error if insufficient resources', async () => {
      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      mockScheduler.select.mockResolvedValue({
        endpointId: 1,
        host: {} as any,
        score: 0,
      });
      mockScheduler.validateResources.mockResolvedValue({
        valid: false,
        reason: 'Insufficient memory',
      });

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('Insufficient resources');
    });

    it('should cleanup container on creation failure', async () => {
      const mockHost: HostSelection = {
        endpointId: 1,
        host: {} as any,
        score: 0,
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      mockScheduler.select.mockResolvedValue(mockHost);
      mockScheduler.validateResources.mockResolvedValue({ valid: true });
      mockPortainerClient.createContainer.mockResolvedValue({
        Id: 'container-fail',
        Warnings: [],
      });
      mockPortainerClient.startContainer.mockRejectedValue(new Error('Start failed'));
      mockPortainerClient.getContainer.mockRejectedValue(new Error('Not found'));
      mockPortainerClient.removeContainer.mockResolvedValue(undefined);

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('Start failed');

      expect(mockPortainerClient.removeContainer).toHaveBeenCalledWith(1, 'container-fail', true);
    });
  });

  describe('getTenant', () => {
    it('should return tenant info', async () => {
      const mockTenant = {
        tenant_id: 'tenant-user123',
        container_id: 'container-abc',
        endpoint_id: 1,
        user_id: 'user123',
        gateway_token: 'token',
        port: 18789,
        status: 'running',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant);
      mockPortainerClient.getContainer.mockResolvedValue({
        Id: 'container-abc',
        Name: 'tenant-user123',
        State: { Running: true, Status: 'running' },
        NetworkSettings: { Ports: {} },
        Config: { Labels: {} },
      });

      const result = await service.getTenant('user123');

      expect(result).toBeDefined();
      expect(result.tenantId).toBe('tenant-user123');
      expect(result.status).toBe('running');
    });

    it('should update status when container is stopped', async () => {
      const mockTenant = {
        tenant_id: 'tenant-user123',
        container_id: 'container-abc',
        endpoint_id: 1,
        gateway_token: 'token',
        port: 18789,
        status: 'running',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant);
      mockPortainerClient.getContainer.mockResolvedValue({
        Id: 'container-abc',
        Name: 'tenant-user123',
        State: { Running: false, Status: 'exited' },
        NetworkSettings: { Ports: {} },
        Config: { Labels: {} },
      });
      vi.mocked(tenantDb.update).mockResolvedValue({
        ...mockTenant,
        status: 'stopped',
      });

      const result = await service.getTenant('user123');

      expect(result.status).toBe('stopped');
    });

    it('should return null if tenant not found', async () => {
      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);

      const result = await service.getTenant('user123');

      expect(result).toBeNull();
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant and container', async () => {
      const mockTenant = {
        tenant_id: 'tenant-user123',
        container_id: 'container-abc',
        endpoint_id: 1,
        user_id: 'user123',
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant as any);
      mockPortainerClient.stopContainer.mockResolvedValue(undefined);
      mockPortainerClient.removeContainer.mockResolvedValue(undefined);
      vi.mocked(tenantDb.delete).mockResolvedValue(true);

      const result = await service.deleteTenant('user123');

      expect(result).toBe(true);
      expect(mockPortainerClient.stopContainer).toHaveBeenCalledWith(1, 'container-abc');
      expect(mockPortainerClient.removeContainer).toHaveBeenCalledWith(1, 'container-abc', true);
      expect(vi.mocked(tenantDb.delete)).toHaveBeenCalledWith('tenant-user123');
    });
  });

  describe('restartTenant', () => {
    it('should restart tenant container', async () => {
      const mockTenant = {
        tenant_id: 'tenant-user123',
        container_id: 'container-abc',
        endpoint_id: 1,
        user_id: 'user123',
        status: 'running',
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant as any);
      mockPortainerClient.restartContainer.mockResolvedValue(undefined);
      vi.mocked(tenantDb.update).mockResolvedValue(mockTenant as any);

      await service.restartTenant('user123');

      expect(mockPortainerClient.restartContainer).toHaveBeenCalledWith(1, 'container-abc');
      expect(vi.mocked(tenantDb.update)).toHaveBeenCalledWith('tenant-user123', { status: 'running' });
    });
  });
});
