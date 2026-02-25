# OpenClaw 多租户管理系统 - 测试设计文档

> 版本: 1.0.0
> 更新时间: 2026-02-06

---

## 目录

1. [测试策略](#测试策略)
2. [单元测试](#单元测试)
3. [集成测试](#集成测试)
4. [端到端测试](#端到端测试)
5. [性能测试](#性能测试)
6. [测试环境](#测试环境)
7. [测试执行](#测试执行)

---

## 测试策略

### 测试金字塔

```
         /\
        /  \
       / E2E \        ← 少量，关键用户流程
      /______\
     /        \
    /Integration \    ← 中等，API 和组件交互
   /______________\
  /                \
 /   Unit Tests     \  ← 大量，快速反馈
/____________________\
```

### 测试覆盖目标

| 测试类型 | 覆盖率目标 | 运行频率 |
|---------|-----------|---------|
| 单元测试 | 80%+ | 每次 CI/CD |
| 集成测试 | 70%+ | 每次 CI/CD |
| E2E 测试 | 关键流程 | 每日/发布前 |
| 性能测试 | N/A | 每周/发布前 |

---

## 单元测试

### 测试框架

- **框架**: Vitest
- **断言**: Chai (内置)
- **Mock**: vi (内置)

### 测试模块

#### 1. 配置模块测试

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { config, quotas, getQuota } from '../tenant-manager/src/config';

describe('Config', () => {
  describe('quota parsing', () => {
    it('should parse free quota correctly', () => {
      const free = quotas.free;
      expect(free.cpu).toBe(0.5);
      expect(free.memory).toBe(512);
      expect(free.storage).toBe(5120);
      expect(free.sandboxes).toBe(1);
    });

    it('should parse basic quota correctly', () => {
      const basic = quotas.basic;
      expect(basic.cpu).toBe(1);
      expect(basic.memory).toBe(1024);
      expect(basic.storage).toBe(20480);
      expect(basic.sandboxes).toBe(3);
    });
  });

  describe('getQuota', () => {
    it('should return correct quota for plan', () => {
      const basicQuota = getQuota('basic');
      expect(basicQuota.cpu).toBe(1);
    });

    it('should return basic quota for unknown plan', () => {
      const unknownQuota = getQuota('unknown' as any);
      expect(unknownQuota.cpu).toBe(1); // defaults to basic
    });
  });
});
```

#### 2. Portainer 客户端测试

```typescript
// tests/portainer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortainerClient } from '../tenant-manager/src/portainer';
import fetch from 'node-fetch';

vi.mock('node-fetch');

describe('PortainerClient', () => {
  let client: PortainerClient;

  beforeEach(() => {
    client = new PortainerClient('http://localhost:9000', 'test-api-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEnvironments', () => {
    it('should fetch environments from Portainer', async () => {
      const mockEnvs = [
        { Id: 1, Name: 'local', Status: 1, Type: 1, URL: 'tcp://localhost:2375', PublicURL: 'localhost:9443' },
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
          }),
        })
      );
    });

    it('should cache GET requests', async () => {
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
  });

  describe('createContainer', () => {
    it('should create container with correct config', async () => {
      const mockResponse = { Id: 'container-123', Warnings: [] };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.createContainer(1, {
        name: 'test-container',
        image: 'nginx:latest',
        env: ['TEST=1'],
        labels: { 'test': 'label' },
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:9000/api/endpoints/1/docker/containers/create',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-container'),
        })
      );
    });
  });
});
```

#### 3. 调度器测试

```typescript
// tests/scheduler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantScheduler } from '../tenant-manager/src/scheduler';
import { getPortainerClient } from '../tenant-manager/src/portainer';
import { tenantDb } from '../tenant-manager/src/database';

vi.mock('../tenant-manager/src/portainer');
vi.mock('../tenant-manager/src/database');

describe('TenantScheduler', () => {
  let scheduler: TenantScheduler;

  beforeEach(() => {
    scheduler = new TenantScheduler();
    vi.clearAllMocks();
  });

  describe('selectByRoundRobin', () => {
    it('should select host with least tenants', async () => {
      const mockHosts = [
        { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        { Id: 2, Name: 'host-2', Status: 1, Type: 1, URL: 'tcp://host2:2375', PublicURL: 'host2' },
      ];

      vi.mocked(getPortainerClient).mockReturnValue({
        getAvailableEnvironments: async () => mockHosts,
        getDockerInfo: async () => ({ NCPU: 4, MemTotal: 8000000000, MemUsed: 2000000000 }),
      } as any);

      vi.mocked(tenantDb.countByEndpoint)
        .mockResolvedValueOnce(5) // host-1 has 5 tenants
        .mockResolvedValueOnce(2); // host-2 has 2 tenants

      const selection = await scheduler.selectByRoundRobin({
        plan: 'basic',
      });

      expect(selection?.endpointId).toBe(2); // Should select host-2
      expect(selection?.host.Name).toBe('host-2');
    });

    it('should return null when no hosts available', async () => {
      vi.mocked(getPortainerClient).mockReturnValue({
        getAvailableEnvironments: async () => [],
      } as any);

      const selection = await scheduler.selectByRoundRobin({
        plan: 'basic',
      });

      expect(selection).toBeNull();
    });
  });

  describe('validateResources', () => {
    it('should validate sufficient resources', async () => {
      vi.mocked(getPortainerClient).mockReturnValue({
        getDockerInfo: async () => ({ NCPU: 4, MemTotal: 8000000000, MemUsed: 2000000000 }),
      } as any);

      const validation = await scheduler.validateResources(1, 'basic');

      expect(validation.valid).toBe(true);
    });

    it('should reject insufficient memory', async () => {
      vi.mocked(getPortainerClient).mockReturnValue({
        getDockerInfo: async () => ({ NCPU: 4, MemTotal: 1000000000, MemUsed: 900000000 }),
      } as any);

      const validation = await scheduler.validateResources(1, 'basic');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Insufficient memory');
    });
  });
});
```

#### 4. 租户服务测试

```typescript
// tests/tenant-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from '../tenant-manager/src/tenant-service';
import { getPortainerClient } from '../tenant-manager/src/portainer';
import { tenantDb } from '../tenant-manager/src/database';
import { getScheduler } from '../tenant-manager/src/scheduler';

vi.mock('../tenant-manager/src/portainer');
vi.mock('../tenant-manager/src/database');
vi.mock('../tenant-manager/src/scheduler');

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    service = new TenantService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create tenant successfully', async () => {
      const mockSelection = {
        endpointId: 1,
        host: { Id: 1, Name: 'host-1', Status: 1, Type: 1, URL: 'tcp://host1:2375', PublicURL: 'host1' },
        score: 100,
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      vi.mocked(getScheduler().select).mockResolvedValue(mockSelection);
      vi.mocked(getScheduler().validateResources).mockResolvedValue({ valid: true });

      vi.mocked(getPortainerClient().createContainer).mockResolvedValue({
        Id: 'container-123',
        Warnings: [],
      });

      vi.mocked(getPortainerClient().getContainer).mockResolvedValue({
        Id: 'container-123',
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
        container_id: 'container-123',
        port: 18789,
        endpoint_id: 1,
        status: 'running',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.create({
        userId: 'user123',
        email: 'user@example.com',
        plan: 'basic',
      });

      expect(result).toMatchObject({
        tenantId: 'tenant-user123',
        userId: 'user123',
        status: 'running',
        host: 'host-1',
        port: 18789,
      });
    });

    it('should throw error if user already has tenant', async () => {
      vi.mocked(tenantDb.getByUserId).mockResolvedValue({
        tenant_id: 'existing-tenant',
      } as any);

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('already has a tenant');
    });

    it('should throw error if no available host', async () => {
      vi.mocked(tenantDb.getByUserId).mockResolvedValue(null);
      vi.mocked(getScheduler().select).mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'user123',
          email: 'user@example.com',
        })
      ).rejects.toThrow('No available host');
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant and container', async () => {
      const mockTenant = {
        tenant_id: 'tenant-user123',
        container_id: 'container-123',
        endpoint_id: 1,
      };

      vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant as any);
      vi.mocked(getPortainerClient().stopContainer).mockResolvedValue(undefined);
      vi.mocked(getPortainerClient().removeContainer).mockResolvedValue(undefined);
      vi.mocked(tenantDb.delete).mockResolvedValue(true);

      const result = await service.deleteTenant('user123');

      expect(result).toBe(true);
      expect(getPortainerClient().stopContainer).toHaveBeenCalledWith(1, 'container-123');
      expect(getPortainerClient().removeContainer).toHaveBeenCalledWith(1, 'container-123', true);
    });
  });
});
```

### 运行单元测试

```bash
cd multi-tenant/tenant-manager
pnpm install
pnpm test              # 运行所有测试
pnpm test:coverage      # 运行测试并生成覆盖率报告
pnpm test --ui         # 使用 UI 模式
```

---

## 集成测试

### 测试场景

#### 1. 租户创建流程

```typescript
// tests/integration/tenant-creation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { getPortainerClient } from '../../tenant-manager/src/portainer';
import { TenantService } from '../../tenant-manager/src/tenant-service';
import { getScheduler } from '../../tenant-manager/src/scheduler';

describe('Tenant Creation Integration', () => {
  let pool: Pool;
  let tenantService: TenantService;

  beforeAll(async () => {
    // 连接测试数据库
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });

    // 运行迁移
    await pool.query(await fs.promises.readFile('./database/schema.sql', 'utf8'));

    tenantService = new TenantService();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create tenant end-to-end', async () => {
    // Mock Portainer responses
    // ... (使用 testcontainers 或 mock Portainer)

    const result = await tenantService.create({
      userId: 'test-user-001',
      email: 'test@example.com',
      plan: 'basic',
    });

    expect(result.tenantId).toBe('tenant-test-user-001');
    expect(result.status).toBe('running');
    expect(result.port).toBeGreaterThan(0);

    // 验证数据库记录
    const { rows } = await pool.query(
      'SELECT * FROM tenants WHERE tenant_id = $1',
      [result.tenantId]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe('test-user-001');
    expect(rows[0].container_id).toBeTruthy();
  });
});
```

#### 2. API 集成测试

```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { closeDatabase } from '../../tenant-manager/src/database';
import app from '../../tenant-manager/src/index';

describe('API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    // 启动测试服务器
    server = app.listen(3001);
  });

  afterAll(async () => {
    server.close();
    await closeDatabase();
  });

  describe('POST /api/tenants', () => {
    it('should create tenant with valid data', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'test@example.com',
          plan: 'basic',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        tenantId: expect.any(String),
        status: 'running',
      });
    });

    it('should reject invalid plan', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'test@example.com',
          plan: 'invalid',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/tenants/me', () => {
    it('should return tenant info', async () => {
      const response = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenantId');
    });
  });

  describe('GET /api/internal/route', () => {
    it('should resolve tenant route', async () => {
      const response = await request(app)
        .get('/api/internal/route?host=tenant-test.openclaw.app');

      expect(response.status).toBe(200);
      expect(response.headers['x-target']).toBeTruthy();
    });
  });
});
```

---

## 端到端测试

### 测试框架

- **Playwright**: 浏览器自动化
- **Docker Compose**: 环境编排

### 测试场景

#### 1. 用户创建租户流程

```typescript
// tests/e2e/tenant-creation.spec.ts
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Tenant Creation E2E', () => {
  test.beforeAll(async () => {
    // 启动测试环境
    execSync('cd multi-tenant && docker-compose up -d', {
      stdio: 'inherit',
    });

    // 等待服务就绪
    await waitForService('http://localhost:3000/api/health');
  });

  test.afterAll(async () => {
    // 清理测试环境
    execSync('cd multi-tenant && docker-compose down -v', {
      stdio: 'inherit',
    });
  });

  test('user can create tenant through UI', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3000');
    await page.click('text=Login');
    await page.fill('[name=email]', 'test@example.com');
    await page.click('button[type=submit]');

    // 等待仪表板
    await expect(page).toHaveURL(/.*dashboard/);

    // 创建租户
    await page.click('text=Create Tenant');
    await page.fill('[name=email]', 'my-tenant@example.com');
    await page.selectOption('[name=plan]', 'basic');
    await page.click('button[type=submit]');

    // 等待创建完成
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.tenant-url')).toContainText('tenant-');
  });

  test('tenant is accessible via subdomain', async ({ page, request }) => {
    // 先创建租户
    const response = await request.post('http://localhost:3000/api/tenants', {
      headers: {
        Authorization: `Bearer ${getTestToken()}`,
      },
      data: {
        email: 'e2e-test@example.com',
        plan: 'basic',
      },
    });

    const { tenantId } = await response.json();

    // 访问租户 URL
    await page.goto(`http://${tenantId}.openclaw.app`);

    // 验证可以访问
    await expect(page).toHaveTitle(/OpenClaw/);
  });
});

async function waitForService(url: string, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Ignore connection errors
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Service not ready: ${url}`);
}

function getTestToken() {
  // 生成测试用的 JWT token
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
}
```

#### 2. 租户隔离测试

```typescript
// tests/e2e/tenant-isolation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tenant Isolation', () => {
  test('tenants cannot access each other data', async ({ page }) => {
    // 创建两个租户
    const tenant1 = await createTenant('tenant-1@example.com');
    const tenant2 = await createTenant('tenant-2@example.com');

    // 登录租户 1
    await loginAs(page, tenant1.userId);

    // 尝试访问租户 2 的数据
    const response = await page.request.get(`/api/tenants/${tenant2.tenantId}`);

    expect(response.status()).toBe(403);
  });

  test('tenants have separate containers', async ({ page }) => {
    const tenant1 = await createTenant('tenant-1@example.com');
    const tenant2 = await createTenant('tenant-2@example.com');

    // 检查容器名称不同
    expect(tenant1.containerId).not.toBe(tenant2.containerId);

    // 检查端口不同
    expect(tenant1.port).not.toBe(tenant2.port);
  });
});
```

### 运行 E2E 测试

```bash
cd multi-tenant
pnpm test:e2e

# 或者使用 Playwright CLI
npx playwright test
```

---

## 性能测试

### 测试工具

- **k6**: 负载测试
- **autocannon**: HTTP 基准测试

### 测试场景

#### 1. 租户创建负载测试

```javascript
// tests/performance/tenant-creation.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // 10 用户/秒
    { duration: '1m', target: 50 },    // 50 用户/秒
    { duration: '30s', target: 100 },  // 100 用户/秒
    { duration: '1m', target: 100 },   // 稳定
    { duration: '30s', target: 0 },    // 冷却
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 请求 < 500ms
    http_req_failed: ['rate<0.01'],    // 错误率 < 1%
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    email: `test-${__VU}@example.com`,
    plan: 'basic',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_TOKEN}`,
    },
  };

  // 创建租户
  const res = http.post(`${BASE_URL}/api/tenants`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'has tenantId': (r) => {
      const body = JSON.parse(r.body);
      return !!body.tenantId;
    },
  });

  sleep(1);
}
```

#### 2. 租户路由负载测试

```javascript
// tests/performance/routing.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],  // 路由应该很快
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const tenantId = `tenant-${__VU % 10}`; // 10 个租户循环
  const url = `http://tenant-${tenantId}.openclaw.app/`;

  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### 运行性能测试

```bash
# 租户创建负载测试
k6 run tests/performance/tenant-creation.k6.js

# 租户路由负载测试
k6 run tests/performance/routing.k6.js

# 使用 autocannon
npx autocannon -c 100 -d 30 http://localhost:3000/api/health
```

---

## 测试环境

### 环境变量

```bash
# .env.test
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://openclaw:test123@localhost:5433/openclaw_test
PORTAINER_URL=http://localhost:9000
PORTAINER_API_KEY=test-api-key
JWT_SECRET=test-secret-key-for-testing-only-min-32-chars
```

### Docker Compose 测试配置

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=openclaw_test
      - POSTGRES_USER=openclaw
      - POSTGRES_PASSWORD=test123
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  portainer-mock:
    image: portainer/portainer-ce:latest
    ports:
      - "9001:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

---

## 测试执行

### CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: openclaw_test
          POSTGRES_USER: openclaw
          POSTGRES_PASSWORD: test123
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: |
          cd multi-tenant/tenant-manager
          pnpm install

      - name: Run unit tests
        run: |
          cd multi-tenant/tenant-manager
          pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: |
          cd multi-tenant
          docker-compose -f docker-compose.test.yml up -d

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: |
          cd multi-tenant
          npx playwright test

      - name: Stop services
        if: always()
        run: |
          cd multi-tenant
          docker-compose -f docker-compose.test.yml down -v
```

### 本地测试命令

```bash
# 安装依赖
cd multi-tenant/tenant-manager
pnpm install

# 单元测试
pnpm test
pnpm test:coverage

# 集成测试（需要服务运行）
pnpm test:integration

# E2E 测试
cd multi-tenant
npx playwright test

# 性能测试
k6 run tests/performance/tenant-creation.k6.js
```

---

## 测试数据清理

### 测试数据隔离

```typescript
// tests/test-setup.ts
import { Pool } from 'pg';

export async function setupTestDatabase(pool: Pool) {
  // 创建测试专用 schema
  await pool.query(`DROP SCHEMA IF EXISTS test_schema CASCADE`);
  await pool.query(`CREATE SCHEMA test_schema`);
  await pool.query(`SET search_path TO test_schema`);

  // 运行迁移
  const schema = await fs.promises.readFile('./database/schema.sql', 'utf8');
  await pool.query(schema);
}

export async function cleanupTestDatabase(pool: Pool) {
  // 清理所有测试数据
  await pool.query(`DROP SCHEMA IF EXISTS test_schema CASCADE`);
}

export async function createTestUser(pool: Pool, userId: string) {
  await pool.query(
    `INSERT INTO tenants (tenant_id, user_id, email, plan, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [`tenant-${userId}`, userId, `${userId}@test.com`, 'basic', 'running']
  );
}
```

---

## 测试报告

### 生成测试报告

```bash
# HTML 覆盖率报告
pnpm test:coverage --reporter=html

# Playwright HTML 报告
npx playwright test --reporter=html
```

### 报告目录

```
multi-tenant/
├── coverage/           # Vitest 覆盖率报告
├── playwright-report/  # Playwright E2E 报告
└── test-results/       # 测试结果 JSON
```
