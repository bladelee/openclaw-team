// Portainer 客户端单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortainerClient } from '../src/portainer.js';

// Mock node-fetch module
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

const fetch = (await import('node-fetch')).default;

describe('PortainerClient', () => {
  let client: PortainerClient;

  beforeEach(() => {
    client = new PortainerClient('http://localhost:9000', 'test-api-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultClient = new PortainerClient();
      expect(defaultClient).toBeInstanceOf(PortainerClient);
    });
  });

  describe('getEnvironments', () => {
    it('should fetch environments from Portainer API', async () => {
      const mockEnvs = [
        {
          Id: 1,
          Name: 'local',
          Status: 1,
          Type: 1,
          URL: 'tcp://localhost:2375',
          PublicURL: 'localhost:9443',
          StatusDescription: 'up',
        },
        {
          Id: 2,
          Name: 'remote-worker',
          Status: 1,
          Type: 1,
          URL: 'tcp://192.168.1.10:2376',
          PublicURL: '192.168.1.10',
          StatusDescription: 'up',
        },
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockEnvs,
      } as Response);

      const envs = await client.getEnvironments();

      expect(envs).toEqual(mockEnvs);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      } as Response);

      await expect(client.getEnvironments()).rejects.toThrow('Portainer API error: 401 Unauthorized');
    });

    it('should cache results', async () => {
      const mockEnvs = [{ Id: 1, Name: 'local', Status: 1 }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockEnvs,
      } as Response);

      // First call
      await client.getEnvironments();

      // Second call should use cache
      await client.getEnvironments();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
      const mockEnvs = [{ Id: 1, Name: 'local', Status: 1 }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockEnvs,
      } as Response);

      // Populate cache
      await client.getEnvironments();

      // Clear cache
      client.clearCache();

      // Should fetch again
      await client.getEnvironments();

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAvailableEnvironments', () => {
    it('should return only environments with status 1', async () => {
      const mockEnvs = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 2, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
        { Id: 3, Name: 'host-3', Status: 1, Type: 1, URL: 'tcp://host3:2375', PublicURL: 'host3' },
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockEnvs,
      } as Response);

      const available = await client.getAvailableEnvironments();

      expect(available).toHaveLength(2);
      expect(available[0].Id).toBe(1);
      expect(available[1].Id).toBe(3);
    });
  });

  describe('createContainer', () => {
    it('should create container with correct configuration', async () => {
      const mockResponse = { Id: 'container-123', Warnings: [] };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const config = {
        name: 'test-container',
        image: 'nginx:latest',
        env: ['TEST=1'],
        labels: { 'test': 'label', 'managed': 'true' },
        hostConfig: {
          portBindings: { '80/tcp': [{ hostPort: '8080' }] },
          memory: 512 * 1024 * 1024,
          cpuQuota: 500000,
        },
      };

      const result = await client.createContainer(1, config);

      expect(result).toEqual(mockResponse);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints/1/docker/containers/create',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"test-container"'),
          body: expect.stringContaining('"Image":"nginx:latest"'),
        })
      );
    });

    it('should include RestartPolicy in HostConfig', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ Id: 'container-123', Warnings: [] }),
      } as Response);

      await client.createContainer(1, {
        name: 'test',
        image: 'nginx',
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.HostConfig.RestartPolicy).toEqual({ Name: 'unless-stopped' });
    });
  });

  describe('startContainer', () => {
    it('should start container', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.startContainer(1, 'container-123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints/1/docker/containers/container-123/start',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('stopContainer', () => {
    it('should stop container', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.stopContainer(1, 'container-123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints/1/docker/containers/container-123/stop',
        expect.objectContaining({
          method: 'POST',
          timeout: 10000,
        })
      );
    });
  });

  describe('removeContainer', () => {
    it('should remove container', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.removeContainer(1, 'container-123', true);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints/1/docker/containers/container-123?force=true',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should not force remove by default', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.removeContainer(1, 'container-123', false);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?force=false'),
        expect.any(Object)
      );
    });
  });

  describe('getContainer', () => {
    it('should get container info', async () => {
      const mockContainer = {
        Id: 'container-123',
        Name: 'test-container',
        State: {
          Running: true,
          Status: 'running',
        },
        NetworkSettings: {
          Ports: {
            '80/tcp': [{ HostPort: '8080' }],
          },
        },
        Config: {
          Labels: {
            'test': 'label',
          },
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContainer,
      } as Response);

      const container = await client.getContainer(1, 'container-123');

      expect(container).toEqual(mockContainer);
      expect(container.State.Running).toBe(true);
    });
  });

  describe('getTenantContainers', () => {
    it('should return only containers with openclaw.tenant label', async () => {
      const mockContainers = [
        {
          Id: 'container-1',
          Names: ['/tenant-a'],
          Config: { Labels: { 'openclaw.tenant': 'tenant-a', 'openclaw.user': 'user-a' } },
        },
        {
          Id: 'container-2',
          Names: ['/other-container'],
          Config: { Labels: {} },
        },
        {
          Id: 'container-3',
          Names: ['/tenant-b'],
          Config: { Labels: { 'openclaw.tenant': 'tenant-b' } },
        },
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContainers,
      } as Response);

      const tenantContainers = await client.getTenantContainers(1);

      expect(tenantContainers).toHaveLength(2);
      expect(tenantContainers[0].Config.Labels['openclaw.tenant']).toBe('tenant-a');
      expect(tenantContainers[1].Config.Labels['openclaw.tenant']).toBe('tenant-b');
    });
  });
});
