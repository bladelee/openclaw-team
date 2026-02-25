// Tenants API tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { instancesApi } from './tenants';
import api from './client';

// Mock the API client
vi.mock('./client');

// Mock types
vi.mock('@/types/tenant', () => ({
  InstanceSource: 'managed' as const,
}));

describe('instancesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should get all instances', async () => {
      const mockInstances = [
        {
          instanceId: 'test-1',
          userId: 'user-1',
          name: 'test-1',
          email: 'test@example.com',
          plan: 'basic',
          url: 'https://test-1.openclaw.app',
          status: 'running',
          containerId: 'container-1',
          containerName: 'openclaw-test-1',
          createdAt: '2024-01-01',
        },
      ];

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockInstances });

      const result = await instancesApi.getAll();

      expect(api.get).toHaveBeenCalledWith('/instances');
      expect(result).toEqual(mockInstances);
    });

    it('should handle empty response', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

      const result = await instancesApi.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should get instance by ID', async () => {
      const mockInstance = {
        instanceId: 'test-1',
        userId: 'user-1',
        name: 'test-1',
        email: 'test@example.com',
        plan: 'basic',
        url: 'https://test-1.openclaw.app',
        status: 'running',
        containerId: 'container-1',
        containerName: 'openclaw-test-1',
        createdAt: '2024-01-01',
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockInstance });

      const result = await instancesApi.getById('test-1');

      expect(api.get).toHaveBeenCalledWith('/instances/test-1');
      expect(result).toEqual(mockInstance);
    });
  });

  describe('create', () => {
    it('should create a new instance', async () => {
      const input = {
        email: 'test@example.com',
        name: 'test-instance',
        plan: 'basic' as const,
      };

      const mockInstance = {
        instanceId: 'instance-test-instance',
        userId: 'user-1',
        name: 'test-instance',
        email: 'test@example.com',
        plan: 'basic',
        url: 'https://test-instance.openclaw.app',
        status: 'running',
        containerId: 'container-1',
        containerName: 'openclaw-test-instance',
        createdAt: '2024-01-01',
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockInstance });

      const result = await instancesApi.create(input);

      expect(api.post).toHaveBeenCalledWith('/instances', input);
      expect(result).toEqual(mockInstance);
    });

    it('should create instance without optional name', async () => {
      const input = {
        email: 'test@example.com',
        plan: 'basic' as const,
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          instanceId: 'instance-abc123',
          name: 'user-abc123',
          plan: 'basic',
        },
      });

      await instancesApi.create(input);

      expect(api.post).toHaveBeenCalledWith('/instances', input);
    });
  });

  describe('delete', () => {
    it('should delete instance', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({
        data: { success: true },
      });

      const result = await instancesApi.delete('test-instance');

      expect(api.delete).toHaveBeenCalledWith('/instances/test-instance');
      expect(result).toEqual({ success: true });
    });
  });

  describe('restart', () => {
    it('should restart instance', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true },
      });

      const result = await instancesApi.restart('test-instance');

      expect(api.post).toHaveBeenCalledWith('/instances/test-instance/restart');
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateName', () => {
    it('should update instance name', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({
        data: { success: true, name: 'new-name' },
      });

      const result = await instancesApi.updateName('test-instance', 'new-name');

      expect(api.put).toHaveBeenCalledWith('/instances/test-instance', { name: 'new-name' });
      expect(result).toEqual({ success: true, name: 'new-name' });
    });
  });

  describe('getLogs', () => {
    it('should get logs with default tail', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: 'log line 1\nlog line 2',
      });

      const result = await instancesApi.getLogs('test-instance');

      expect(api.get).toHaveBeenCalledWith('/instances/test-instance/logs?tail=100', {
        responseType: 'text',
      });
      expect(result).toBe('log line 1\nlog line 2');
    });

    it('should get logs with custom tail', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: 'log line 1',
      });

      await instancesApi.getLogs('test-instance', 50);

      expect(api.get).toHaveBeenCalledWith('/instances/test-instance/logs?tail=50', {
        responseType: 'text',
      });
    });
  });
});

describe('Custom Instance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCustom', () => {
    it('should register cloud instance', async () => {
      const input = {
        name: 'my-cloud',
        instanceType: 'cloud' as const,
        url: 'https://example.com',
      };

      const mockInstance = {
        instance_id: 'instance-my-cloud',
        user_id: 'user-1',
        name: 'my-cloud',
        source: 'custom' as const,
        custom_url: 'https://example.com',
        url: 'https://example.com',
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockInstance });

      const result = await instancesApi.registerCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom', input);
      expect(result).toEqual(mockInstance);
    });

    it('should register hardware instance', async () => {
      const input = {
        name: 'home-box',
        instanceType: 'hardware' as const,
        ip: '192.168.1.100',
        port: 18789,
      };

      const mockInstance = {
        instance_id: 'instance-home-box',
        user_id: 'user-1',
        name: 'home-box',
        source: 'hardware' as const,
        custom_url: 'http://192.168.1.100:18789',
        url: 'http://192.168.1.100:18789',
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockInstance });

      const result = await instancesApi.registerCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom', input);
      expect(result.source).toBe('hardware');
    });

    it('should include optional fields', async () => {
      const input = {
        name: 'my-instance',
        instanceType: 'cloud' as const,
        url: 'https://example.com',
        apiToken: 'secret-token',
        healthCheckUrl: 'https://example.com/health',
        healthCheckInterval: 120,
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { instance_id: 'instance-my-instance' },
      });

      await instancesApi.registerCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom', input);
    });
  });

  describe('validateCustom', () => {
    it('should validate cloud instance', async () => {
      const input = {
        instanceType: 'cloud' as const,
        url: 'https://example.com',
      };

      const mockResult = {
        urlValid: true,
        apiAccessible: false,
        healthCheck: true,
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.validateCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom/validate', input);
      expect(result).toEqual(mockResult);
    });

    it('should validate hardware instance', async () => {
      const input = {
        instanceType: 'hardware' as const,
        ip: '192.168.1.100',
        port: 18789,
      };

      const mockResult = {
        urlValid: true,
        apiAccessible: false,
        healthCheck: true,
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.validateCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom/validate', input);
      expect(result.urlValid).toBe(true);
    });

    it('should include token in validation', async () => {
      const input = {
        instanceType: 'cloud' as const,
        url: 'https://example.com',
        apiToken: 'test-token',
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        data: { urlValid: true, apiAccessible: true, healthCheck: true },
      });

      await instancesApi.validateCustom(input);

      expect(api.post).toHaveBeenCalledWith('/instances/custom/validate', input);
    });

    it('should return error message on failure', async () => {
      const input = {
        instanceType: 'cloud' as const,
        url: 'https://unreachable.example.com',
      };

      const mockResult = {
        urlValid: false,
        apiAccessible: false,
        healthCheck: false,
        error: 'Connection timeout',
      };

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.validateCustom(input);

      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockResult = {
        instanceId: 'test-instance',
        isHealthy: true,
        lastCheck: '2024-01-01T00:00:00Z',
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.healthCheck('test-instance');

      expect(api.get).toHaveBeenCalledWith('/instances/test-instance/health');
      expect(result).toEqual(mockResult);
    });

    it('should return unhealthy status', async () => {
      const mockResult = {
        instanceId: 'test-instance',
        isHealthy: false,
        lastCheck: '2024-01-01T00:00:00Z',
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.healthCheck('test-instance');

      expect(result.isHealthy).toBe(false);
    });
  });

  describe('scanLocalNetwork', () => {
    it('should scan local network with defaults', async () => {
      const mockResult = {
        subnet: '192.168.1',
        port: 18789,
        devices: [],
        count: 0,
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.scanLocalNetwork();

      expect(api.get).toHaveBeenCalledWith('/instances/scan-local?subnet=192.168.1&port=18789');
      expect(result).toEqual(mockResult);
    });

    it('should scan with custom subnet', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { subnet: '10.0.0', port: 18789, devices: [], count: 0 },
      });

      await instancesApi.scanLocalNetwork('10.0.0');

      expect(api.get).toHaveBeenCalledWith('/instances/scan-local?subnet=10.0.0&port=18789');
    });

    it('should scan with custom port', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { subnet: '192.168.1', port: 8080, devices: [], count: 0 },
      });

      await instancesApi.scanLocalNetwork('192.168.1', 8080);

      expect(api.get).toHaveBeenCalledWith('/instances/scan-local?subnet=192.168.1&port=8080');
    });

    it('should return discovered devices', async () => {
      const mockResult = {
        subnet: '192.168.1',
        port: 18789,
        devices: [
          { ip: '192.168.1.100', name: 'Device-1', type: 'hardware' },
          { ip: '192.168.1.101', name: 'Device-2', type: 'hardware' },
        ],
        count: 2,
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult });

      const result = await instancesApi.scanLocalNetwork();

      expect(result.devices).toHaveLength(2);
      expect(result.devices[0].ip).toBe('192.168.1.100');
    });
  });
});
