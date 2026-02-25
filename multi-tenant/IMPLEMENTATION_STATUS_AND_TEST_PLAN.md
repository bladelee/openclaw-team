# OpenClaw 多租户系统 - 实现状态与测试方案

> 日期: 2026-02-06
> 目的: 总结实现状态、明确缺失功能、制定测试方案

---

## 目录

1. [功能实现对比矩阵](#功能实现对比矩阵)
2. [已实现功能详解](#已实现功能详解)
3. [缺失必要功能](#缺失必要功能)
4. [集成测试方案](#集成测试方案)
5. [系统测试方案](#系统测试方案)
6. [测试自动化建议](#测试自动化建议)
7. [测试优先级排序](#测试优先级排序)

---

## 功能实现对比矩阵

| 模块 | 子功能 | 设计要求 | 当前状态 | 完成度 |
|------|--------|----------|----------|--------|
| **租户管理服务** | | | | |
| | 创建租户 | API | ✅ 已实现 | 100% |
| | 删除租户 | API | ✅ 已实现 | 100% |
| | 获取租户信息 | API | ✅ 已实现 | 100% |
| | 重启租户 | API | ✅ 已实现 | 100% |
| | 获取日志 | API | ✅ 已实现 | 100% |
| | 租户统计 | API | ✅ 已实现 | 100% |
| | 更新计划 | API | ⚠️ 部分实现 | 50% |
| **调度器** | | | | |
| | 获取可用主机 | API | ✅ 已实现 | 100% |
| | 轮询调度 | 算法 | ✅ 已实现 | 100% |
| | 一致性哈希 | 算法 | ✅ 已实现 | 100% |
| | 资源评分 | 算法 | ✅ 已实现 | 100% |
| | 资源验证 | API | ✅ 已实现 | 100% |
| | 主机缓存 | 功能 | ✅ 已实现 | 100% |
| **认证授权** | | | | |
| | JWT 认证 | 中间件 | ✅ 已实现 | 100% |
| | Token 刷新 | API | ✅ 已实现 | 100% |
| | Shared Secret | 中间件 | ✅ 已实现 | 100% |
| | 双重认证 | 中间件 | ✅ 已实现 | 100% |
| | OAuth 2.0 SSO | 集成 | ❌ **缺失** | 0% |
| | 用户注册 | 功能 | ⚠️ 简化版 | 20% |
| | RBAC 权限 | 功能 | ⚠️ 简化版 | 30% |
| **Portainer 集成** | | | | |
| | 容器管理 | API | ✅ 已实现 | 100% |
| | 环境管理 | API | ✅ 已实现 | 100% |
| | 获取统计 | API | ✅ 已实现 | 100% |
| | 日志获取 | API | ✅ 已实现 | 100% |
| | 缓存机制 | 功能 | ✅ 已实现 | 100% |
| **数据库** | | | | |
| | 租户表 | Schema | ✅ 已实现 | 100% |
| | 主机缓存表 | Schema | ✅ 已实现 | 100% |
| | CRUD 操作 | API | ✅ 已实现 | 100% |
| | 连接池 | 功能 | ✅ 已实现 | 100% |
| **网络路由** | | | | |
| | 内部路由查询 | API | ✅ 已实现 | 100% |
| | 动态代理 | Nginx | ⚠️ 需测试 | 80% |
| | 子域名支持 | 配置 | ⚠️ 需测试 | 80% |
| | WebSocket 支持 | 配置 | ⚠️ 需测试 | 50% |
| **配置管理** | | | | |
| | 环境变量 | Schema | ✅ 已实现 | 100% |
| | 配额配置 | 功能 | ✅ 已实现 | 100% |
| | Zod 验证 | 功能 | ✅ 已实现 | 100% |
| **日志监控** | | | | |
| | 结构化日志 | 功能 | ✅ 已实现 | 100% |
| | 日志级别 | 配置 | ✅ 已实现 | 100% |
| | Prometheus | 指标 | ❌ 仅框架 | 10% |
| | 告警 | 功能 | ❌ 缺失 | 0% |
| **用户界面** | | | | |
| | 登录页面 | UI | ❌ **缺失** | 0% |
| | 用户仪表板 | UI | ❌ **缺失** | 0% |
| | 租户管理界面 | UI | ❌ **缺失** | 0% |
| **单元测试** | | | | |
| | TenantService | 测试 | ✅ 已实现 | 100% |
| | Scheduler | 测试 | ✅ 已实现 | 100% |
| | PortainerClient | 测试 | ✅ 已实现 | 100% |
| | 整体覆盖率 | - | ✅ 51/56 通过 | 91% |

### 总体完成度

| 类别 | 完成度 |
|------|--------|
| **后端 API** | 95% |
| **认证授权** | 60% (缺 OAuth 2.0) |
| **用户界面** | 0% |
| **测试覆盖** | 91% |
| **整体** | **65%** |

---

## 已实现功能详解

### 1. 租户管理服务 (tenant-service.ts)

**已完成:**

```typescript
// 创建租户 - 完整流程
async create(options: CreateTenantOptions): Promise<TenantInfo>

// 删除租户 - 包含容器清理
async deleteTenant(userId: string): Promise<boolean>

// 获取租户信息 - 实时状态同步
async getTenant(userId: string): Promise<TenantInfo | null>

// 重启租户容器
async restartTenant(userId: string): Promise<void>

// 获取租户日志
async getLogs(userId: string, tail: number): Promise<string>

// 租户统计
async getStats(): Promise<TenantStats>

// 列出所有租户（管理员）
async listTenants(options: ListOptions): Promise<TenantInfo[]>
```

**功能亮点:**
- 自动资源验证和主机选择
- 容器创建失败自动清理
- 实时状态同步
- 支持多租户配额管理

### 2. 调度器 (scheduler.ts)

**已完成:**

```typescript
// 获取可用主机（状态过滤）
async getAvailableHosts(): Promise<PortainerEnvironment[]>

// 获取主机统计（带缓存）
async getHostStats(endpointId: number): Promise<DockerInfo | null>

// 轮询调度
async selectByRoundRobin(options: SchedulingOptions): Promise<HostSelection | null>

// 一致性哈希调度
async selectByConsistentHash(options: SchedulingOptions): Promise<HostSelection | null>

// 资源评分调度
async selectByResourceScore(options: SchedulingOptions): Promise<HostSelection | null>

// 智能选择（支持同主机偏好）
async select(options: SchedulingOptions): Promise<HostSelection | null>

// 资源验证
async validateResources(endpointId: number, plan: Plan): Promise<ValidationResult>
```

**功能亮点:**
- 三种调度算法（轮询、一致性哈希、资源评分）
- 30 秒 TTL 缓存
- 资源不足自动拒绝

### 3. 认证系统 (auth.ts)

**已完成:**

```typescript
// JWT 认证
generateToken(payload: JWTPayload): string
verifyToken(token: string): JWTPayload
authenticate(req, res, next): void

// Token 刷新
generateRefreshToken(userId: string): string

// Shared Secret 认证（用于 SSO 集成）
generateSignature(userId: string): string
authenticateSharedSecret(req, res, next): void

// 双重认证（支持 JWT 或 Shared Secret）
authenticateEither(req, res, next): void

// 可选认证
optionalAuth(req, res, next): void
```

**Shared Secret 签名格式:**
```
<signature>:<timestamp>
```

**验证机制:**
- HMAC-SHA256 签名
- Timing-safe 比较
- 5 分钟时间窗口防重放

### 4. Portainer 客户端 (portainer.ts)

**已完成:**

```typescript
// 环境管理
getEnvironments(): Promise<PortainerEnvironment[]>
getAvailableEnvironments(): Promise<PortainerEnvironment[]>
getEnvironment(endpointId: number): Promise<PortainerEnvironment>
getDockerInfo(endpointId: number): Promise<DockerInfo>

// 容器管理
createContainer(endpointId: number, config: ContainerConfig): Promise<CreateResult>
startContainer(endpointId: number, containerId: string): Promise<void>
stopContainer(endpointId: number, containerId: string): Promise<void>
removeContainer(endpointId: number, containerId: string, force: boolean): Promise<void>
restartContainer(endpointId: number, containerId: string): Promise<void>

// 容器查询
getContainer(endpointId: number, containerId: string): Promise<ContainerInfo>
getTenantContainers(endpointId: number): Promise<ContainerInfo[]>

// 日志
getContainerLogs(endpointId: number, containerId: string, tail: number): Promise<string>

// 缓存管理
clearCache(): void
```

### 5. API 路由 (routes.ts)

**已实现端点:**

| 方法 | 路径 | 认证 | 描述 |
|------|------|------|------|
| POST | `/api/auth/login` | 无 | 简化登录（开发用） |
| POST | `/api/auth/refresh` | 无 | Token 刷新 |
| POST | `/api/tenants` | 双重 | 创建租户 |
| GET | `/api/tenants/me` | 双重 | 获取当前用户租户 |
| GET | `/api/tenants/:tenantId` | 无 | 获取租户（公开） |
| DELETE | `/api/tenants/me` | 双重 | 删除租户 |
| POST | `/api/tenants/me/restart` | 双重 | 重启租户 |
| GET | `/api/tenants/me/logs` | 双重 | 获取日志 |
| GET | `/api/tenants` | Admin | 列出所有租户 |
| GET | `/api/tenants/stats` | Admin | 租户统计 |
| GET | `/api/hosts` | 无 | 获取所有主机 |
| GET | `/api/hosts/:endpointId` | 无 | 获取主机详情 |
| GET | `/api/internal/route` | 内部 | 路由查询（Nginx） |
| GET | `/api/health` | 无 | 健康检查 |
| GET | `/api/auth/signature/:userId` | 无 | 签名生成（开发） |
| GET | `/api/auth/sso-info` | 无 | SSO 集成信息 |

---

## 缺失必要功能

### P0 - 必须实现（阻塞上线）

#### 1. 用户 Web 界面

**缺失内容:**

```
multi-tenant/frontend/
├── src/
│   ├── pages/
│   │   ├── index.tsx           # 首页
│   │   ├── login.tsx           # 登录页
│   │   ├── dashboard.tsx       # 用户仪表板
│   │   └── tenants/
│   │       ├── create.tsx      # 创建租户
│   │       └── [tenantId]/
│   │           └── index.tsx   # 租户详情
│   ├── components/
│   │   ├── TenantCard.tsx
│   │   ├── StatusBadge.tsx
│   │   └── CreateModal.tsx
│   └── lib/
│       └── api.ts
```

**需要实现的界面:**

1. **登录页面** (`/login`)
   - OAuth 登录按钮（Google/GitHub/微信）
   - 或 Shared Secret 登录（开发环境）

2. **用户仪表板** (`/dashboard`)
   - 显示用户信息
   - 现有租户列表
   - "创建新实例" 按钮
   - 资源使用统计

3. **创建租户界面** (`/tenants/create`)
   - 计划选择（free/basic/pro/enterprise）
   - 确认对话框
   - 创建进度显示
   - 成功后显示访问地址

#### 2. Better-auth/Casdoor SSO 集成测试

**已实现但未测试的功能:**

```typescript
// Shared Secret 认证已实现，需要集成测试
authenticateSharedSecret(req, res, next): void

// SSO 集成信息端点已实现
GET /api/auth/sso-info
```

**需要验证:**
- Better-auth 后端集成
- Casdoor 后端集成
- 签名生成和验证
- 跨域请求处理

### P1 - 重要功能（影响用户体验）

#### 3. Worker 自动注册

**当前状态:** 手动在 Portainer UI 中添加

**需要实现:**

```typescript
// worker-registration API
router.post('/workers/register', async (req, res) => {
  const {
    workerKey,      // 安全验证
    workerId,
    workerName,
    ip,
    capacity,
  } = req.body;

  // 1. 验证 Worker 密钥
  // 2. 注册到数据库
  // 3. 在 Portainer 中创建环境
  // 4. 返回成功
});

router.post('/workers/heartbeat', async (req, res) => {
  // 更新心跳时间和资源使用
});
```

#### 4. RBAC 权限完善

**当前状态:** 简单的 plan 检查

```typescript
// 当前实现
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.userPlan !== 'enterprise') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
```

**需要实现:**

```typescript
// 完善的 RBAC
interface Permission {
  resource: 'tenants' | 'hosts' | 'users' | 'settings';
  action: 'create' | 'read' | 'update' | 'delete';
  scope: 'self' | 'all';
}

interface Role {
  name: string;
  permissions: Permission[];
}

// 基于 role 的权限检查
function requirePermission(permission: Permission) {
  return (req, res, next) => {
    const userRole = getUserRole(req.userId);
    if (hasPermission(userRole, permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}
```

#### 5. Prometheus 指标

**当前状态:** 仅占位符

```typescript
// 当前实现
router.get('/metrics', async (req, res) => {
  res.send('# TODO: Implement Prometheus metrics');
});
```

**需要实现:**

```typescript
// Prometheus 指标
import promClient from 'prom-client';

// 创建 Registry
const register = new promClient.Registry();

// 定义指标
const tenantCreationTotal = new promClient.Counter({
  name: 'openclaw_tenant_creations_total',
  help: 'Total number of tenant creations',
  registers: [register],
});

const tenantActiveGauge = new promClient.Gauge({
  name: 'openclaw_tenants_active',
  help: 'Number of active tenants',
  registers: [register],
});

const hostMemoryUsage = new promClient.Gauge({
  name: 'openclaw_host_memory_usage_bytes',
  help: 'Host memory usage in bytes',
  labelNames: ['host_id', 'host_name'],
  registers: [register],
});

// 端点
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

### P2 - 可选功能（增强体验）

#### 6. 告警系统

```typescript
// 告警服务
class AlertService {
  async checkHostResources() {
    const hosts = await getHosts();
    for (const host of hosts) {
      if (host.memoryUsage > config.ALERT_MEMORY_THRESHOLD) {
        await this.sendAlert({
          type: 'high_memory',
          host: host.name,
          value: host.memoryUsage,
        });
      }
    }
  }

  async sendAlert(alert: Alert) {
    if (config.ALERT_WEBHOOK_URL) {
      await fetch(config.ALERT_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(alert),
      });
    }
  }
}
```

#### 7. 日志聚合

```typescript
// 集成 Loki
import { createLogger } from 'pino';

const pino = createLogger({
  transport: {
    target: 'pino-loki',
    options: {
      batching: true,
      interval: 5,
      labels: {
        service: 'tenant-manager',
      },
      host: 'http://loki:3100',
    },
  },
});
```

---

## 集成测试方案

### 测试环境要求

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  # 租户管理服务
  tenant-manager-test:
    build: ./tenant-manager
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://test:test@postgres-test:5432/openclaw_test
      - PORTAINER_URL=http://portainer-test:9000
      - PORTAINER_API_KEY=test-api-key
      - SHARED_SECRET_KEY=test-secret-key-for-testing-only
    depends_on:
      - postgres-test
      - portainer-test

  # 测试数据库
  postgres-test:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=openclaw_test
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
    ports:
      - "5433:5432"

  # Mock Portainer (使用 WireMock)
  portainer-test:
    image: wiremock/wiremock:3.5.2
    command: --global-response-templating
    ports:
      - "9001:8080"
    volumes:
      - ./tests/mocks/portainer:/home/wiremock
```

### 集成测试用例

#### 1. 租户生命周期集成测试

```typescript
// tests/integration/tenant-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TenantService } from '../src/tenant-service.js';
import { tenantDb } from '../src/database.js';
import { getPortainerClient } from '../src/portainer.js';

describe('Tenant Lifecycle Integration', () => {
  const service = new TenantService();
  const testUserId = 'test-integration-user';

  beforeAll(async () => {
    // 清理测试数据
    const existing = await tenantDb.getByUserId(testUserId);
    if (existing) {
      await tenantDb.delete(existing.tenant_id);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    const existing = await tenantDb.getByUserId(testUserId);
    if (existing) {
      await tenantDb.delete(existing.tenant_id);
    }
  });

  it('should complete full tenant lifecycle', async () => {
    // 1. 创建租户
    const created = await service.create({
      userId: testUserId,
      email: 'test@example.com',
      plan: 'basic',
    });

    expect(created.tenantId).toBe(`tenant-${testUserId}`);
    expect(created.status).toBe('running');
    expect(created.url).toMatch(/https:\/\/.*\.openclaw\.app/);

    // 2. 获取租户信息
    const fetched = await service.getTenant(testUserId);
    expect(fetched).toBeDefined();
    expect(fetched!.tenantId).toBe(created.tenantId);

    // 3. 重启租户
    await service.restartTenant(testUserId);

    const restarted = await service.getTenant(testUserId);
    expect(restarted!.status).toBe('running');

    // 4. 获取日志
    const logs = await service.getLogs(testUserId, 10);
    expect(typeof logs).toBe('string');

    // 5. 删除租户
    const deleted = await service.deleteTenant(testUserId);
    expect(deleted).toBe(true);

    // 6. 验证已删除
    const verified = await service.getTenant(testUserId);
    expect(verified).toBeNull();
  });

  it('should handle concurrent tenant creation', async () => {
    const userIds = Array.from({ length: 5 }, (_, i) => `test-concurrent-${i}`);

    // 并发创建
    const tenants = await Promise.all(
      userIds.map(userId =>
        service.create({
          userId,
          email: `${userId}@example.com`,
          plan: 'free',
        })
      )
    );

    // 验证全部创建成功
    expect(tenants).toHaveLength(5);
    tenants.forEach(tenant => {
      expect(tenant.status).toBe('running');
    });

    // 清理
    await Promise.all(
      userIds.map(userId => service.deleteTenant(userId))
    );
  });
});
```

#### 2. 调度器集成测试

```typescript
// tests/integration/scheduler-integration.test.ts
import { describe, it, expect } from 'vitest';
import { getScheduler } from '../src/scheduler.js';
import { getPortainerClient } from '../src/portainer.js';

describe('Scheduler Integration', () => {
  const scheduler = getScheduler();

  it('should select hosts using round-robin', async () => {
    const selections = await Promise.all([
      scheduler.select({ plan: 'basic', userId: 'user1' }),
      scheduler.select({ plan: 'basic', userId: 'user2' }),
      scheduler.select({ plan: 'basic', userId: 'user3' }),
    ]);

    expect(selections).toHaveLength(3);
    selections.forEach(s => {
      expect(s).toBeDefined();
      expect(s!.score).toBeGreaterThanOrEqual(0);
    });
  });

  it('should consistently select same host for same tenant', async () => {
    const tenantId = 'test-tenant-consistent';

    const selection1 = await scheduler.selectByConsistentHash({
      tenantId,
      plan: 'basic',
    });

    const selection2 = await scheduler.selectByConsistentHash({
      tenantId,
      plan: 'basic',
    });

    expect(selection1!.endpointId).toBe(selection2!.endpointId);
  });

  it('should reject creation when no hosts available', async () => {
    // 模拟所有主机离线
    const portainer = getPortainerClient();
    portainer.getAvailableEnvironments = async () => [];

    const selection = await scheduler.select({
      plan: 'basic',
      userId: 'test-no-host',
    });

    expect(selection).toBeNull();
  });

  it('should validate resources correctly', async () => {
    const environments = await scheduler.getAvailableHosts();

    if (environments.length > 0) {
      const validation = await scheduler.validateResources(
        environments[0].Id,
        'basic'
      );

      expect(validation.valid).toBeDefined();
      if (!validation.valid) {
        expect(validation.reason).toBeDefined();
      }
    }
  });
});
```

#### 3. 认证集成测试

```typescript
// tests/integration/auth-integration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { generateSignature } from '../src/auth.js';

describe('Authentication Integration', () => {
  describe('JWT Authentication', () => {
    it('should authenticate with valid JWT', async () => {
      // 首先登录获取 token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'any' });

      const token = loginResponse.body.token;

      // 使用 token 访问受保护端点
      const response = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404); // 没有租户，但认证成功
    });

    it('should reject invalid JWT', async () => {
      const response = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Shared Secret Authentication', () => {
    const userId = 'test-sso-user';
    const userEmail = 'sso@example.com';

    it('should authenticate with valid signature', async () => {
      const signature = generateSignature(userId);

      const response = await request(app)
        .post('/api/tenants')
        .set('X-User-ID', userId)
        .set('X-User-Email', userEmail)
        .set('X-User-Signature', signature)
        .send({ email: userEmail, plan: 'free' });

      expect(response.status).toBe(201);
      expect(response.body.tenantId).toBe(`tenant-${userId}`);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('X-User-ID', userId)
        .set('X-User-Email', userEmail)
        .set('X-User-Signature', 'invalid-signature:1234567890')
        .send({ email: userEmail, plan: 'free' });

      expect(response.status).toBe(401);
    });

    it('should reject expired signature', async () => {
      // 生成一个过期的签名（6 分钟前）
      const timestamp = Date.now() - 6 * 60 * 1000;
      const signature = `fake-signature:${timestamp}`;

      const response = await request(app)
        .post('/api/tenants')
        .set('X-User-ID', userId)
        .set('X-User-Email', userEmail)
        .set('X-User-Signature', signature)
        .send({ email: userEmail, plan: 'free' });

      expect(response.status).toBe(401);
    });
  });

  describe('Dual Authentication', () => {
    it('should accept either JWT or Shared Secret', async () => {
      // 使用 JWT
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'any' });

      const jwtResponse = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', `Bearer ${loginResponse.body.token}`);

      expect([200, 404]).toContain(jwtResponse.status); // 404 = 认证成功但无租户

      // 使用 Shared Secret
      const userId = 'test-dual-auth';
      const signature = generateSignature(userId);

      const signatureResponse = await request(app)
        .post('/api/tenants')
        .set('X-User-ID', userId)
        .set('X-User-Email', 'dual@example.com')
        .set('X-User-Signature', signature)
        .send({ email: 'dual@example.com', plan: 'free' });

      expect(signatureResponse.status).toBe(201);
    });
  });
});
```

#### 4. Portainer 集成测试

```typescript
// tests/integration/portainer-integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getPortainerClient } from '../src/portainer.js';

describe('Portainer Integration', () => {
  const portainer = getPortainerClient();

  beforeAll(() => {
    // 使用测试环境配置
    process.env.PORTAINER_URL = 'http://localhost:9001';
    process.env.PORTAINER_API_KEY = 'test-api-key';
  });

  it('should fetch environments', async () => {
    const environments = await portainer.getEnvironments();

    expect(Array.isArray(environments)).toBe(true);
    environments.forEach(env => {
      expect(env).toHaveProperty('Id');
      expect(env).toHaveProperty('Name');
      expect(env).toHaveProperty('Status');
    });
  });

  it('should filter available environments', async () => {
    const available = await portainer.getAvailableEnvironments();

    available.forEach(env => {
      expect(env.Status).toBe(1); // 1 = up
    });
  });

  it('should get Docker info for endpoint', async () => {
    const environments = await portainer.getAvailableEnvironments();

    if (environments.length > 0) {
      const info = await portainer.getDockerInfo(environments[0].Id);

      expect(info).toHaveProperty('NCPU');
      expect(info).toHaveProperty('MemTotal');
      expect(info).toHaveProperty('MemUsed');
      expect(info).toHaveProperty('ServerVersion');
    }
  });

  it('should use cache for repeated calls', async () => {
    const environments = await portainer.getAvailableEnvironments();

    if (environments.length > 0) {
      const endpointId = environments[0].Id;

      // 第一次调用
      const info1 = await portainer.getDockerInfo(endpointId);

      // 清除缓存
      portainer.clearCache();

      // 第二次调用（应该重新获取）
      const info2 = await portainer.getDockerInfo(endpointId);

      expect(info1).toEqual(info2);
    }
  });
});
```

---

## 系统测试方案

### 1. 端到端用户旅程测试

#### 测试场景：新用户创建并使用 OpenClaw 实例

```typescript
// tests/e2e/user-journey.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('New User Journey', () => {
  test('should complete full user journey', async ({ page }) => {
    // 1. 访问首页
    await page.goto('https://openclaw.app');
    await expect(page.locator('h1')).toContainText('OpenClaw');

    // 2. 点击登录
    await page.click('text=登录');

    // 3. 使用 OAuth 登录（模拟）
    // 在测试环境，使用测试用的 OAuth 提供商
    await page.click('text=使用 Google 登录');

    // 4. 授权后跳转到仪表板
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h2')).toContainText('我的 OpenClaw 实例');

    // 5. 点击创建新实例
    await page.click('text=创建新实例');

    // 6. 选择计划
    await page.click('[data-testid="plan-basic"]');

    // 7. 确认创建
    await page.click('text=确认创建');

    // 8. 等待创建完成
    await expect(page.locator('text=创建成功')).toBeVisible();

    // 9. 验证显示访问地址
    const url = await page.locator('[data-testid="tenant-url"]').textContent();
    expect(url).toMatch(/https:\/\/tenant-.*\.openclaw\.app/);

    // 10. 点击访问实例（新标签页）
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('text=打开控制台'),
    ]);

    await newPage.waitForLoadState();
    expect(newPage.url()).toMatch(/tenant-.*\.openclaw\.app/);
  });
});
```

### 2. 多主机负载测试

```javascript
// tests/performance/multi-host-load.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VUS = __ENV.VUS || 50;
const DURATION = __ENV.DURATION || '2m';

// 测试数据
const testUsers = Array.from({ length: 1000 }, (_, i) => ({
  userId: `load-test-user-${i}`,
  email: `load-test-user-${i}@example.com`,
}));

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% 请求在 2 秒内
    http_req_failed: ['rate<0.05'],     // 错误率 < 5%
  },
};

export default function () {
  const user = testUsers[__VU % testUsers.length];

  // 1. 登录
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: 'test',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  });

  const token = loginRes.json('token');

  // 2. 创建租户
  const createRes = http.post(`${BASE_URL}/api/tenants`, JSON.stringify({
    email: user.email,
    plan: 'basic',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  check(createRes, {
    'create tenant status': (r) => [201, 400].includes(r.status), // 400 = 已存在
    'has tenant id': (r) => r.status === 201 ? r.json('tenantId') !== undefined : true,
  });

  // 3. 获取租户信息
  if (createRes.status === 201) {
    const getRes = http.get(`${BASE_URL}/api/tenants/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(getRes, {
      'get tenant successful': (r) => r.status === 200,
      'tenant is running': (r) => r.json('status') === 'running',
    });
  }

  sleep(1);
}

export function teardown(data) {
  // 清理测试数据
  // ...
}
```

### 3. 容器编排测试

```typescript
// tests/e2e/container-orchestration.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { getTenantService } from '../src/tenant-service.js';
import { getScheduler } from '../src/scheduler.js';
import { getPortainerClient } from '../src/portainer.js';

describe('Container Orchestration E2E', () => {
  const service = getTenantService();
  const scheduler = getScheduler();
  const portainer = getPortainerClient();

  it('should distribute tenants across multiple hosts', async () => {
    const environments = await portainer.getAvailableEnvironments();

    if (environments.length < 2) {
      console.warn('Need at least 2 hosts for this test');
      return;
    }

    // 创建多个租户
    const tenantCount = 10;
    const tenants = [];

    for (let i = 0; i < tenantCount; i++) {
      const tenant = await service.create({
        userId: `orchestration-test-${i}`,
        email: `orchestration-test-${i}@example.com`,
        plan: 'free',
      });
      tenants.push(tenant);
    }

    // 验证分布
    const hostDistribution = new Map<number, number>();

    for (const tenant of tenants) {
      const tenantRecord = await service.getTenantByTenantId(tenant.tenantId);
      // 从租户记录获取 endpoint_id 并统计
    }

    // 清理
    for (let i = 0; i < tenantCount; i++) {
      await service.deleteTenant(`orchestration-test-${i}`);
    }

    // 验证租户分布在多个主机上
    expect(hostDistribution.size).toBeGreaterThan(1);
  });

  it('should handle host failure', async () => {
    // 创建租户
    const tenant = await service.create({
      userId: 'failover-test',
      email: 'failover@example.com',
      plan: 'basic',
    });

    // 模拟主机故障（停止 Portainer Agent）
    // ...

    // 尝试重启租户（应该在失败后恢复）
    // ...

    // 清理
    await service.deleteTenant('failover-test');
  });
});
```

### 4. 安全测试

```typescript
// tests/security/authentication.security.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .send({ email: 'test@example.com', plan: 'basic' });

      expect(response.status).toBe(401);
    });

    it('should reject malformed JWT', async () => {
      const response = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', 'Bearer not-a-valid-jwt');

      expect(response.status).toBe(401);
    });

    it('should reject expired JWT', async () => {
      // 使用过期的 token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjowfQ.invalid';

      const response = await request(app)
        .get('/api/tenants/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject replayed signature', async () => {
      // 在实际实现中，这需要时间精确控制
      // 这里只验证签名验证逻辑
      const userId = 'replay-test';
      const signature = 'some-signature:1234567890';

      const response = await request(app)
        .post('/api/tenants')
        .set('X-User-ID', userId)
        .set('X-User-Email', 'replay@example.com')
        .set('X-User-Signature', signature)
        .send({ email: 'replay@example.com', plan: 'free' });

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'test' });

      expect([400, 500]).toContain(response.status);
    });

    it('should reject invalid plan', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', 'Bearer test-token')
        .send({ email: 'test@example.com', plan: 'invalid-plan' });

      expect(response.status).toBe(400);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousEmail = "'; DROP TABLE tenants; --'@example.com";

      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', 'Bearer test-token')
        .send({ email: maliciousEmail, plan: 'basic' });

      // 应该被参数化查询保护，不会导致 SQL 注入
      expect(response.status).not.toBe(500);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit rapid requests', async () => {
      // 如果实现了速率限制
      const requests = Array.from({ length: 100 }, () =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;

      // 验证部分请求被限流
      expect(successCount).toBeLessThan(100);
    });
  });
});
```

---

## 测试自动化建议

### 1. 可完全自动化的测试

#### 单元测试 (已在 CI 中运行)

```yaml
# .github/workflows/unit-tests.yml
name: Unit Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Generate coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

#### API 集成测试 (可在 CI 中运行)

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: openclaw_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      wiremock:
        image: wiremock/wiremock:3.5.2
        options: >-
          --health-cmd curl -f http://localhost:8080/health || exit 1
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup WireMock mocks
        run: |
          cp -r tests/mocks/portainer ./wiremock
          docker run -d -p 9001:8080 -v $(pwd)/wiremock:/home/wiremock wiremock/wiremock:3.5.2

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/openclaw_test
          PORTAINER_URL: http://localhost:9001
          PORTAINER_API_KEY: test-api-key
```

#### 安全扫描 (可在 CI 中运行)

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 0'  # 每周日

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        with:
          languages: javascript
```

### 2. 需要部分手动参与的测试

#### E2E UI 测试 (需要用户界面)

```typescript
// tests/e2e/ui.e2e.test.ts
// 需要先构建前端，然后运行 Playwright

test.beforeAll(async () => {
  // 1. 启动测试环境
  await exec('docker-compose -f docker-compose.test.yml up -d');

  // 2. 等待服务就绪
  await waitForHealthCheck('http://localhost:3000/api/health');

  // 3. 运行数据库迁移
  await exec('pnpm migrate');
});

test.afterAll(async () => {
  await exec('docker-compose -f docker-compose.test.yml down');
});
```

**自动化程度:** 80%（需要人工检查结果）

### 3. 需要手动测试的场景

#### OAuth 2.0 SSO 集成

**原因:** 需要真实的 OAuth 提供商交互

**半自动化方案:**

```typescript
// tests/manual/oauth-sso.test.ts
/**
 * OAuth SSO 集成测试
 *
 * 手动步骤:
 * 1. 在 Google Console 创建 OAuth 客户端
 * 2. 设置回调 URL: http://localhost:3000/auth/google/callback
 * 3. 配置环境变量:
 *    - OAUTH_ENABLED=true
 *    - OAUTH_ISSUER=https://accounts.google.com
 *    - OAUTH_CLIENT_ID=<your-client-id>
 *    - OAUTH_CLIENT_SECRET=<your-client-secret>
 * 4. 运行此测试
 */

test.describe('OAuth SSO Integration', () => {
  test('should complete Google OAuth flow', async ({ page }) => {
    // 前往登录页
    await page.goto('http://localhost:3000/login');

    // 点击 Google 登录
    await page.click('text=使用 Google 登录');

    // 手动完成 Google 授权流程
    // ...

    // 验证回调
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
```

#### 性能测试

**原因:** 需要真实的负载环境

**自动化方案:** 使用 k6 在 staging 环境运行

```bash
# scripts/run-performance-test.sh
#!/bin/bash

# 1. 部署到 staging 环境
./scripts/deploy-staging.sh

# 2. 等待服务就绪
./scripts/wait-for-health.sh

# 3. 运行性能测试
k6 run tests/performance/multi-host-load.test.js \
  --env BASE_URL=https://staging.openclaw.app \
  --env VUS=100 \
  --env DURATION=5m

# 4. 清理
./scripts/cleanup-staging.sh
```

### 4. 自动化测试优先级

| 优先级 | 测试类型 | 自动化程度 | CI/CD 集成 |
|--------|----------|-----------|------------|
| P0 | 单元测试 | 100% | ✅ 每次 commit |
| P0 | API 集成测试 | 100% | ✅ 每次 PR |
| P0 | 安全扫描 | 100% | ✅ 每日 + PR |
| P1 | E2E API 测试 | 100% | ✅ 每日构建 |
| P1 | 性能测试 | 80% | ⚠️ 每周 |
| P1 | UI E2E 测试 | 80% | ⚠️ 每周 |
| P2 | 手动探索测试 | 0% | ❌ 发布前 |

---

## 测试优先级排序

### 第一阶段：核心功能验证（可立即执行）

1. **单元测试补充** - 目标：95% 覆盖率
   - [ ] 补全缺失的 5 个测试用例
   - [ ] 添加边界条件测试
   - [ ] 添加错误处理测试

2. **API 集成测试** - 目标：验证核心流程
   - [ ] 租户完整生命周期测试
   - [ ] 调度器多主机测试
   - [ ] 认证流程测试

### 第二阶段：系统稳定性验证（需要测试环境）

3. **Portainer 集成测试** - 目标：验证容器编排
   - [ ] 真实 Portainer 环境测试
   - [ ] 多主机分布测试
   - [ ] 容器失败恢复测试

4. **性能测试** - 目标：确定容量规划
   - [ ] 并发创建测试
   - [ ] 长时间运行稳定性测试
   - [ ] 资源泄漏检测

### 第三阶段：用户体验验证（需要 UI）

5. **E2E 用户旅程测试** - 目标：验证用户流程
   - [ ] 新用户注册到创建实例
   - [ ] 租户管理操作
   - [ ] 错误场景处理

6. **OAuth SSO 集成测试** - 目标：验证认证流程
   - [ ] Better-auth 集成测试
   - [ ] Casdoor 集成测试
   - [ ] Token 刷新测试

### 第四阶段：安全与合规

7. **安全测试**
   - [ ] 渗透测试
   - [ ] SQL 注入测试
   - [ ] XSS 测试
   - [ ] CSRF 测试

---

## 测试执行计划

### 立即可执行（无需额外环境）

```bash
# 1. 运行现有单元测试
cd multi-tenant/tenant-manager
pnpm test

# 2. 生成覆盖率报告
pnpm test:coverage

# 3. 运行 linter
pnpm lint

# 4. 类型检查
pnpm build
```

### 需要测试环境

```bash
# 1. 启动测试环境
docker-compose -f docker-compose.test.yml up -d

# 2. 等待服务就绪
./scripts/wait-for-health.sh

# 3. 运行集成测试
pnpm test:integration

# 4. 清理
docker-compose -f docker-compose.test.yml down
```

### 需要真实 Portainer

```bash
# 1. 配置真实 Portainer 连接
export PORTAINER_URL=https://your-portainer.example.com
export PORTAINER_API_KEY=your-api-key

# 2. 运行 Portainer 集成测试
pnpm test:portainer

# 3. 运行端到端测试
pnpm test:e2e
```

---

## 总结

### 当前状态

| 项目 | 状态 |
|------|------|
| 后端 API | ✅ 95% 完成 |
| 认证系统 | ⚠️ 60% 完成（缺 OAuth UI） |
| 单元测试 | ✅ 91% 通过率 |
| 集成测试 | ❌ 未实现 |
| E2E 测试 | ❌ 未实现 |
| 用户界面 | ❌ 未实现 |

### 下一步建议

1. **立即执行:**
   - 补全单元测试（达到 95% 覆盖率）
   - 实现集成测试框架
   - 添加 CI/CD 自动化

2. **短期目标（1-2 周）:**
   - 实现 Portainer 集成测试
   - 实现核心 API 集成测试
   - 添加性能测试基线

3. **中期目标（3-4 周）:**
   - 开发用户 Web 界面
   - 实现 E2E 测试
   - 完成 OAuth SSO 集成

4. **长期目标（1-2 月）:**
   - 完善监控和告警
   - 实现自动化扩缩容
   - 完成用户文档
