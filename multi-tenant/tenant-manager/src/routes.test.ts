// Routes tests for custom instance APIs
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import router from './routes.js';

// Mock dependencies
vi.mock('./instance-service.js', () => ({
  getInstanceService: () => ({
    create: vi.fn().mockResolvedValue({
      instanceId: 'test-instance',
      name: 'test',
      url: 'https://test.openclaw.app',
    }),
    getInstancesByUser: vi.fn().mockResolvedValue([]),
    getInstance: vi.fn().mockResolvedValue(null),
    deleteInstance: vi.fn().mockResolvedValue(true),
    restartInstance: vi.fn().mockResolvedValue(undefined),
    updateInstanceName: vi.fn().mockResolvedValue(undefined),
    getLogs: vi.fn().mockResolvedValue('test logs'),
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
    listInstances: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('./database.js', () => ({
  instanceDb: {
    create: vi.fn().mockResolvedValue({
      instance_id: 'test-custom',
      user_id: 'test-user',
      name: 'test-custom',
      email: 'test@example.com',
      plan: 'basic',
      source: 'custom',
      custom_url: 'https://example.com',
      url: 'https://example.com',
      status: 'running',
    }),
    getByInstanceId: vi.fn().mockResolvedValue({
      instance_id: 'test-instance',
      user_id: 'test-user',
      name: 'test',
      email: 'test@example.com',
      plan: 'basic',
      url: 'https://example.com',
      status: 'running',
      source: 'custom',
      custom_url: 'https://example.com',
      health_check_url: null,
      health_check_interval: null,
      last_health_check: null,
      is_healthy: null,
    }),
    update: vi.fn().mockResolvedValue({
      instance_id: 'test-instance',
      is_healthy: true,
      last_health_check: new Date(),
    }),
  },
}));

vi.mock('./health-check.js', () => ({
  validateCustomInstance: vi.fn().mockResolvedValue({
    urlValid: true,
    apiAccessible: true,
    healthCheck: true,
  }),
  performHealthCheck: vi.fn().mockResolvedValue(true),
}));

describe('Custom Instance API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      // Mock authentication
      req.userId = 'test-user';
      req.userEmail = 'test@example.com';
      next();
    });
    app.use('/api', router);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/instances/custom', () => {
    it('should register a cloud instance', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'my-cloud-instance',
          instanceType: 'cloud',
          url: 'https://my-claw.example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('instance_id');
      expect(response.body).toHaveProperty('source');
    });

    it('should register a hardware instance', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'home-box',
          instanceType: 'hardware',
          ip: '192.168.1.100',
          port: 18789,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('instance_id');
      expect(response.body.source).toBe('hardware');
    });

    it('should reject cloud instance without URL', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'test',
          instanceType: 'cloud',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject hardware instance without IP', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'test',
          instanceType: 'hardware',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject without authentication', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/api', router);

      const response = await request(appNoAuth)
        .post('/api/instances/custom')
        .send({
          name: 'test',
          instanceType: 'cloud',
          url: 'https://example.com',
        });

      expect(response.status).toBe(401);
    });

    it('should accept optional API token', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'test',
          instanceType: 'cloud',
          url: 'https://example.com',
          apiToken: 'secret-token',
        });

      expect(response.status).toBe(201);
    });

    it('should accept custom health check interval', async () => {
      const response = await request(app)
        .post('/api/instances/custom')
        .send({
          name: 'test',
          instanceType: 'cloud',
          url: 'https://example.com',
          healthCheckInterval: 120,
        });

      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/instances/custom/validate', () => {
    it('should validate cloud instance connection', async () => {
      const { validateCustomInstance } = await import('./health-check.js');
      vi.mocked(validateCustomInstance).mockResolvedValueOnce({
        urlValid: true,
        apiAccessible: true,
        healthCheck: true,
      });

      const response = await request(app)
        .post('/api/instances/custom/validate')
        .send({
          instanceType: 'cloud',
          url: 'https://example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('urlValid', true);
      expect(response.body).toHaveProperty('apiAccessible', true);
      expect(response.body).toHaveProperty('healthCheck', true);
    });

    it('should validate hardware instance connection', async () => {
      const response = await request(app)
        .post('/api/instances/custom/validate')
        .send({
          instanceType: 'hardware',
          ip: '192.168.1.100',
          port: 18789,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('urlValid');
    });

    it('should return validation error for invalid input', async () => {
      const response = await request(app)
        .post('/api/instances/custom/validate')
        .send({
          instanceType: 'cloud',
        });

      expect(response.status).toBe(400);
    });

    it('should handle connection timeout', async () => {
      const { validateCustomInstance } = await import('./health-check.js');
      vi.mocked(validateCustomInstance).mockResolvedValueOnce({
        urlValid: false,
        apiAccessible: false,
        healthCheck: false,
        error: 'Connection timeout',
      });

      const response = await request(app)
        .post('/api/instances/custom/validate')
        .send({
          instanceType: 'cloud',
          url: 'https://unreachable.example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/instances/:instanceId/health', () => {
    it('should return health status for custom instance', async () => {
      const response = await request(app)
        .get('/api/instances/test-instance/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('instanceId', 'test-instance');
      expect(response.body).toHaveProperty('isHealthy');
    });

    it('should return 404 for non-existent instance', async () => {
      const { instanceDb } = await import('./database.js');
      vi.mocked(instanceDb.getByInstanceId).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/instances/non-existent/health');

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      const { instanceDb } = await import('./database.js');
      vi.mocked(instanceDb.getByInstanceId).mockResolvedValueOnce({
        instance_id: 'other-instance',
        user_id: 'other-user',
        name: 'other',
        email: 'other@example.com',
        plan: 'basic',
        url: 'https://example.com',
        status: 'running',
        source: 'custom',
        custom_url: 'https://example.com',
        health_check_url: null,
        health_check_interval: null,
        last_health_check: null,
        is_healthy: null,
        container_id: null,
        container_name: null,
        port: null,
        endpoint_id: null,
        gateway_token: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .get('/api/instances/other-instance/health');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/instances/scan-local', () => {
    it('should scan local network for hardware devices', async () => {
      // Mock successful scan
      global.fetch = vi.fn();

      // Simulate finding a device
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('192.168.1.100:18789')) {
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.reject(new Error('Not found'));
      });

      const response = await request(app)
        .get('/api/instances/scan-local')
        .query({ subnet: '192.168.1', port: '18789' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('subnet');
      expect(response.body).toHaveProperty('devices');
      expect(Array.isArray(response.body.devices)).toBe(true);
    });

    it('should use default subnet if not provided', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

      const response = await request(app)
        .get('/api/instances/scan-local');

      expect(response.status).toBe(200);
      expect(response.body.subnet).toBe('192.168.1');
    });

    it('should use default port if not provided', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

      const response = await request(app)
        .get('/api/instances/scan-local')
        .query({ subnet: '192.168.1' });

      expect(response.status).toBe(200);
      expect(response.body.port).toBe(18789);
    });

    it('should return empty array when no devices found', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

      const response = await request(app)
        .get('/api/instances/scan-local');

      expect(response.status).toBe(200);
      expect(response.body.devices).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle timeout parameter', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      const response = await request(app)
        .get('/api/instances/scan-local')
        .query({ timeout: '500' });

      expect(response.status).toBe(200);
    });
  });
});
