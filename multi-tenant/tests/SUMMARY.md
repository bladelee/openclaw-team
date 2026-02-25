# OpenClaw 多租户管理系统 - 测试总结

> 项目: OpenClaw Multi-Tenant Manager
> 测试框架: Vitest + Playwright + k6
> 更新时间: 2026-02-06

---

## 测试文件结构

```
multi-tenant/
├── tenant-manager/
│   ├── src/                    # 源代码
│   ├── tests/                  # 测试文件
│   │   ├── setup.ts            # 测试设置
│   │   ├── config.test.ts      # 配置模块测试
│   │   ├── portainer.test.ts   # Portainer 客户端测试
│   │   ├── scheduler.test.ts   # 调度器测试
│   │   └── tenant-service.test.ts  # 租户服务测试
│   ├── vitest.config.ts        # Vitest 配置
│   └── package.json
├── tests/
│   ├── TEST_DESIGN.md          # 测试设计文档
│   └── (e2e, integration, performance)  # 其他测试
├── scripts/
│   ├── start.sh                # 启动脚本
│   ├── stop.sh                 # 停止脚本
│   ├── test.sh                 # 测试运行脚本
│   └── add-worker.sh           # 添加 Worker 脚本
└── docker-compose.yml          # 编排配置
```

---

## 已实现的测试

### 单元测试

#### 1. 配置模块测试 (`tests/config.test.ts`)

**测试内容**:
- 环境变量解析
- 资源配额解析
- 配额验证
- 计划递增验证

**测试数量**: 11 个测试用例

**关键测试**:
```typescript
// 验证配额按计划递增
expect(quotas.free.cpu).toBeLessThan(quotas.basic.cpu);
expect(quotas.basic.cpu).toBeLessThan(quotas.pro.cpu);
```

#### 2. Portainer 客户端测试 (`tests/portainer.test.ts`)

**测试内容**:
- 获取环境列表
- 创建容器
- 启动/停止/删除容器
- 缓存机制
- 错误处理

**测试数量**: 20 个测试用例

**关键测试**:
```typescript
// 验证缓存机制
await client.getEnvironments();
await client.getEnvironments();
expect(fetch).toHaveBeenCalledTimes(1); // 应该使用缓存
```

#### 3. 调度器测试 (`tests/scheduler.test.ts`)

**测试内容**:
- 获取可用主机
- 主机选择算法
- 资源验证
- 一致性哈希
- 轮询调度

**测试数量**: 18 个测试用例

**关键测试**:
```typescript
// 验证选择租户最少的主机
const selection = await scheduler.selectByRoundRobin({ plan: 'basic' });
expect(selection.endpointId).toBe(2); // host-2 有更少租户
```

#### 4. 租户服务测试 (`tests/tenant-service.test.ts`)

**测试内容**:
- 创建租户
- 获取租户信息
- 删除租户
- 重启租户
- 错误处理

**测试数量**: 12 个测试用例

**关键测试**:
```typescript
// 验证容器创建参数
expect(createContainer).toHaveBeenCalledWith(1, {
    name: 'tenant-user123',
    image: 'ghcr.io/moltbot/moltbot:latest',
    labels: {
        'openclaw.tenant': 'tenant-user123',
        'openclaw.managed': 'true',
    },
});
```

---

## 运行测试

### 快速开始

```bash
# 进入项目目录
cd multi-tenant

# 安装依赖
cd tenant-manager
pnpm install

# 运行所有测试
pnpm test

# 生成覆盖率报告
pnpm test:coverage
```

### 使用测试脚本

```bash
# 运行单元测试
./scripts/test.sh unit

# 运行单元测试（监听模式）
./scripts/test.sh unit --watch

# 运行所有测试
./scripts/test.sh all

# 生成覆盖率报告
./scripts/test.sh coverage
```

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 | 当前状态 |
|------|-----------|---------|
| config.ts | 90% | ✅ 已实现 |
| portainer.ts | 80% | ✅ 已实现 |
| scheduler.ts | 85% | ✅ 已实现 |
| tenant-service.ts | 80% | ✅ 已实现 |
| database.ts | 70% | ⚠️ 待实现 |
| auth.ts | 70% | ⚠️ 待实现 |
| routes.ts | 60% | ⚠️ 待实现 |

---

## 测试场景

### 单元测试场景

| 场景 | 描述 | 状态 |
|------|------|------|
| 配置解析 | 环境变量正确解析为配置对象 | ✅ |
| 配额验证 | 验证所有配额的合理性 | ✅ |
| 主机获取 | 从 Portainer 获取可用主机 | ✅ |
| 容器创建 | 使用正确参数创建容器 | ✅ |
| 容器生命周期 | 启动、停止、删除容器 | ✅ |
| 缓存机制 | GET 请求被缓存，POST 不缓存 | ✅ |
| 错误处理 | API 错误正确抛出和处理 | ✅ |
| 轮询调度 | 选择租户最少的主机 | ✅ |
| 一致性哈希 | 同一租户总是选择同一主机 | ✅ |
| 资源验证 | 检查主机资源是否足够 | ✅ |
| 租户创建 | 完整创建流程 | ✅ |
| 租户删除 | 完整删除流程包括清理 | ✅ |
| 状态同步 | 从容器同步状态到数据库 | ✅ |

### 集成测试场景（待实现）

| 场景 | 描述 | 优先级 |
|------|------|--------|
| 数据库集成 | 测试数据库连接和事务 | 高 |
| Portainer 集成 | 测试与 Portainer API 的交互 | 高 |
| 端到端租户创建 | 从 API 到容器创建的完整流程 | 高 |
| 租户隔离 | 验证不同租户的资源隔离 | 中 |
| 故障恢复 | 容器失败后的清理和恢复 | 中 |

### E2E 测试场景（待实现）

| 场景 | 描述 | 优先级 |
|------|------|--------|
| 用户创建租户 | 用户通过 UI 创建租户 | 高 |
| 租户访问 | 访问租户子域名 | 高 |
| 租户管理 | 用户管理自己的租户 | 中 |
| 多用户并发 | 多用户同时创建租户 | 低 |

### 性能测试场景（待实现）

| 场景 | 目标 | 指标 |
|------|------|------|
| 租户创建 | 100 并发创建 | P95 < 500ms |
| 路由查询 | 1000 QPS 路由查询 | P95 < 100ms |
| 主机调度 | 调度延迟 | < 50ms |

---

## 测试数据

### 测试用户

| 用户 ID | 邮箱 | 计划 |
|---------|------|------|
| test-user-001 | test-001@example.com | basic |
| test-user-002 | test-002@example.com | pro |
| test-admin | admin@example.com | enterprise |

### 测试主机

| ID | 名称 | 资源 |
|----|------|------|
| 1 | worker-01 | 4 CPU, 8GB RAM |
| 2 | worker-02 | 4 CPU, 8GB RAM |
| 3 | worker-03 | 2 CPU, 4GB RAM |

---

## Mock 策略

### Portainer Mock

```typescript
// Mock Portainer 响应
vi.mocked(getPortainerClient().getEnvironments).mockResolvedValue([
    { Id: 1, Name: 'worker-01', Status: 1, ... },
]);
```

### 数据库 Mock

```typescript
// Mock 数据库查询
vi.mocked(tenantDb.getByUserId).mockResolvedValue(mockTenant);
```

### 调度器 Mock

```typescript
// Mock 调度器选择
vi.mocked(getScheduler().select).mockResolvedValue(mockSelection);
```

---

## 持续集成

### GitHub Actions 工作流

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - name: Install dependencies
        run: cd multi-tenant/tenant-manager && pnpm install
      - name: Run tests
        run: cd multi-tenant/tenant-manager && pnpm test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 测试命令速查

```bash
# 单元测试
cd tenant-manager && pnpm test

# 覆盖率
cd tenant-manager && pnpm test:coverage

# 监听模式
cd tenant-manager && pnpm test --watch

# UI 模式
cd tenant-manager && pnpm test --ui

# 特定测试文件
cd tenant-manager && pnpm test tenant-service.test.ts

# 运行测试脚本
./scripts/test.sh unit
./scripts/test.sh all
./scripts/test.sh coverage
```

---

## 下一步

### 待实现的测试

1. **集成测试**
   - 数据库集成测试
   - Portainer API 集成测试
   - API 端到端测试

2. **E2E 测试**
   - 用户界面测试
   - 多用户场景测试
   - 跨浏览器测试

3. **性能测试**
   - 负载测试
   - 压力测试
   - 基准测试

4. **安全测试**
   - 认证测试
   - 授权测试
   - 输入验证测试
