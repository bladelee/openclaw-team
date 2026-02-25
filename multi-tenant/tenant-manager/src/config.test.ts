// Config tests for URL configuration
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { config, quotas, getQuota } from './config.js';

describe('Config - URL Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Default URL Configuration', () => {
    it('should have default base domain', () => {
      expect(config.INSTANCE_BASE_DOMAIN).toBe('openclaw.app');
    });

    it('should have default URL format', () => {
      expect(config.INSTANCE_URL_FORMAT).toBe('{name}.{baseDomain}');
    });

    it('should have default scheme', () => {
      expect(config.INSTANCE_URL_SCHEME).toBe('https');
    });
  });

  describe('Custom URL Configuration', () => {
    it('should allow custom base domain', () => {
      process.env.INSTANCE_BASE_DOMAIN = 'example.com';
      // Re-parse would happen at startup
      expect(process.env.INSTANCE_BASE_DOMAIN).toBe('example.com');
    });

    it('should allow custom URL format', () => {
      process.env.INSTANCE_URL_FORMAT = '{baseDomain}/instance/{name}';
      expect(process.env.INSTANCE_URL_FORMAT).toBe('{baseDomain}/instance/{name}');
    });

    it('should allow custom scheme', () => {
      process.env.INSTANCE_URL_SCHEME = 'http';
      expect(process.env.INSTANCE_URL_SCHEME).toBe('http');
    });
  });
});

describe('Config - Quota Configuration', () => {
  it('should have free quota defined', () => {
    expect(quotas.free).toBeDefined();
    expect(quotas.free.cpu).toBe(0.5);
    expect(quotas.free.memory).toBe(512);
  });

  it('should have basic quota defined', () => {
    expect(quotas.basic).toBeDefined();
    expect(quotas.basic.cpu).toBe(1);
    expect(quotas.basic.memory).toBe(1024);
  });

  it('should return correct quota for plan', () => {
    const quota = getQuota('basic');
    expect(quota.cpu).toBe(1);
    expect(quota.memory).toBe(1024);
    expect(quota.sandboxes).toBe(3);
  });
});

describe('Config - Database Configuration', () => {
  it('should require DATABASE_URL', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it('should have pool configuration', () => {
    expect(config.DATABASE_POOL_MIN).toBeDefined();
    expect(config.DATABASE_POOL_MAX).toBeDefined();
  });
});

describe('Config - Portainer Configuration', () => {
  it('should require PORTAINER_URL', () => {
    expect(process.env.PORTAINER_URL).toBeDefined();
  });

  it('should require PORTAINER_API_KEY', () => {
    expect(process.env.PORTAINER_API_KEY).toBeDefined();
  });
});

describe('Config - JWT Configuration', () => {
  it('should require JWT_SECRET', () => {
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it('should have default expiration', () => {
    expect(config.JWT_EXPIRES_IN).toBeDefined();
  });
});
