# OpenClaw 多租户系统 - 实现对比 Review

> 日期: 2026-02-06
> 目的: 对比设计文档与实际实现，找出缺失功能

---

## 功能对比矩阵

| 功能模块 | 设计文档要求 | 当前实现状态 | 缺失/问题 |
|---------|------------|-------------|----------|
| **租户管理服务** | ✅ 已实现 | | |
| 创建租户 | ✅ API 已实现 | ✅ | |
| 删除租户 | ✅ API 已实现 | ✅ | |
| 租户调度 | ✅ 多种策略 | ✅ | |
| Portainer 集成 | ✅ | ✅ | |
| **认证授权** | | | |
| OAuth 2.0 SSO | ✅ 独立授权服务器 | ❌ **缺失** | 只有简化 JWT |
| 用户注册/登录 | ✅ 通过 Google/GitHub/微信 | ❌ **缺失** | 无 UI |
| Token 刷新 | ✅ refresh_token | ✅ | |
| 权限控制 | ✅ RBAC | ⚠️ 简化版 | 需完善 |
| **用户界面** | | | |
| Web 控制台 | ✅ 用户管理界面 | ❌ **缺失** | 只有 API |
| 租户仪表板 | ✅ 状态监控 | ❌ **缺失** | - |
| OAuth 登录页面 | ✅ 授权码流程 | ❌ **缺失** | - |
| **主机初始化** | | | |
| 工厂预装 | ✅ 设备凭证生成 | ❌ **缺失** | - |
| 用户开机配网 | ✅ AP 模式/QR 码 | ❌ **缺失** | - |
| 设备绑定 | ✅ 用户认领 | ⚠️ 需完善 | - |
| **网络路由** | | | |
| 动态路由 | ✅ Nginx + 内部 API | ✅ | - |
| 子域名访问 | ✅ tenant.openclaw.app | ✅ | - |
| WebSocket 支持 | ✅ | ⚠️ 需测试 | - |
| **监控告警** | | | |
| Prometheus 指标 | ✅ | ⚠️ 框架有了，无指标 | ❌ |
| 健康检查 | ✅ | ✅ | - |
| 日志聚合 | ✅ | ⚠️ 文件日志 | ❌ |

---

## 关键缺失功能详解

### 1. OAuth 2.0 SSO 集成

#### 设计要求

```
用户浏览器
    │
    ▼
┌─────────────────┐
│  Web 前端      │
│  (openclaw.app) │
└────────┬────────┘
         │
         │ ① OAuth 登录 (重定向)
         ▼
┌─────────────────────────┐
│  OAuth 2.0 Provider     │
│  (授权服务器)           │
│  - Google               │
│  - GitHub               │
│  - 微信                  │
└────────┬────────────────┘
         │
         │ ② 授权码 + Token
         ▼
┌─────────────────────────┐
│  租户管理 API            │
│  (验证 Token)            │
└────────┬────────────────┘
         │
         │ ③ 创建租户 Token
         ▼
┌─────────────────────────┐
│  用户                    │
│  (访问自己的 OpenClaw)  │
└─────────────────────────┘
```

#### 当前实现

**仅有简化 JWT**:
```typescript
// 当前只有简单的 JWT 生成，没有 OAuth 集成
app.post('/auth/login', async (req, res) => {
  // ❌ 没有真正的密码验证
  // ❌ 没有 OAuth 重定向
  const token = generateToken({
    userId: email.split('@')[0],  // 简化处理
    email,
    plan: 'basic',
  });
});
```

#### 需要实现

**1. OAuth 2.0 授权服务器**

```typescript
// 缺失: 独立的 OAuth 授权服务器
// 建议使用现有方案或集成到租户管理服务中

// 使用 Passport.js 实现 OAuth 2.0
import passport from 'passport';
import { Strategy as OAuthStrategy } from 'passport-oauth2';

// Google OAuth 2.0
passport.use('google', new OAuthStrategy({
    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: 'https://oauth2.googleapis.com/token',
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
    // 查找或创建用户
    const user = await findOrCreateUser(profile);
    return done(null, user);
}));
```

**2. 回调处理**

```typescript
// 缺失: OAuth 回调端点
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    // 用户已认证
    const user = req.user;

    // 生成 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      plan: user.plan || 'basic',
    });

    // 重定向到前端
    res.redirect(`https://openclaw.app/dashboard?token=${token}`);
  });
```

**3. 前端 OAuth 集成**

```html
<!-- 缺失: 用户登录页面 -->
<!DOCTYPE html>
<html>
<head>
    <title>OpenClaw - 登录</title>
</head>
<body>
    <h1>登录 OpenClaw</h1>
    <a href="/api/auth/google">使用 Google 登录</a>
    <a href="/api/auth/github">使用 GitHub 登录</a>
</body>
</html>
```

---

### 2. 用户使用流程

#### 设计要求的用户旅程

```
1. 用户访问 openclaw.app
   ↓
2. 点击 "登录"
   ↓
3. 选择 OAuth 提供商 (Google/GitHub/微信)
   ↓
4. 在 OAuth 提供商页面授权
   ↓
5. 重定向回 openclaw.app/dashboard
   ↓
6. 点击 "创建我的 OpenClaw"
   ↓
7. 输入租户名称
   ↓
8. 系统自动创建容器
   ↓
9. 显示访问地址: https://tenant-xxx.openclaw.app
   ↓
10. 点击访问，进入自己的 OpenClaw
```

#### 当前缺失的流程

**缺少**:
- ❌ 用户注册/登录界面
- ❌ 用户仪表板
- ❌ 创建租户的 UI
- ❌ 租户状态监控界面
- ❌ 租户日志查看界面

#### 需要实现的组件

**1. 前端 Web 应用**

```
multi-tenant/frontend/
├── src/
│   ├── pages/
│   │   ├── index.tsx           # 首页
│   │   ├── login.tsx           # 登录页
│   │   ├── dashboard.tsx       # 用户仪表板
│   │   └── tenants/
│   │       ├── create.tsx      # 创建租户
│   │       ├── list.tsx        # 租户列表
│   │       └── [tenantId]/
│   │           ├── index.tsx    # 租户详情
│   │           └── logs.tsx     # 日志查看
│   ├── components/
│   │   ├── OAuthButton.tsx    # OAuth 登录按钮
│   │   ├── TenantCard.tsx     # 租户卡片
│   │   └── StatusBadge.tsx    # 状态徽章
│   └── lib/
│       └── api.ts             # API 客户端
```

**2. 用户仪表板 (Dashboard)**

```typescript
// 缺失: 用户仪表板组件
export function Dashboard() {
  const { user, tenants } = useUser();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="dashboard">
      <header>
        <h1>我的 OpenClaw 实例</h1>
        <Button onClick={() => setIsCreating(true)}>
          + 创建新实例
        </Button>
      </header>

      <div className="tenants-grid">
        {tenants.map(tenant => (
          <TenantCard
            key={tenant.tenantId}
            tenant={tenant}
          />
        ))}
      </div>

      {isCreating && (
        <CreateTenantModal
          onClose={() => setIsCreating(false)}
          onCreated={(newTenant) => {
            setTenants([...tenants, newTenant]);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}
```

---

### 3. 主机初始化流程

#### 设计要求

根据 `IOT_PROVISIONING_CN.md` 和 `IOT_OAUTH_AUTH_FLOW_CN.md`，有两种场景：

**场景 A: 云端虚拟主机（当前实现）**

```
管理员操作:
1. 在服务器上安装 Docker
2. 运行 ./scripts/add-worker.sh
3. 在 Portainer UI 中添加环境
4. 自动注册到租户管理服务

自动化流程:
- Worker 启动后自动调用注册 API
- 定期心跳保持在线状态
```

**场景 B: 硬件盒子（未实现）**

```
工厂阶段:
1. 生成设备凭证 (device_id, device_password)
2. 预注册到云端

用户收货:
1. 盒子上电
2. 自动进入配网模式
3. 显示 QR 码
4. 用户扫码
5. 下载 App 或在网页上配网
```

#### 当前实现状态

**场景 A (云主机)**: ✅ 部分实现

```bash
# ✅ 已有: 添加 Worker 脚本
./scripts/add-worker.sh worker-01 http://192.168.1.10:9000

# ⚠️ 需完善: 自动注册功能
# 当前需要手动在 Portainer UI 添加
# 应该实现自动注册 API
```

**需要补充**:

```typescript
// 缺失: Worker 自动注册 API
// tenant-manager/src/routes/worker.ts

// Worker 注册端点
router.post('/workers/register', express.json(), async (req, res) => {
  const {
    workerId,
    workerName,
    ip,
    capacity
  } = req.body;

  // 验证 Worker 密钥（安全）
  const valid = validateWorkerKey(req.body.workerKey);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid worker key' });
  }

  // 注册到数据库
  await db.query(`
    INSERT INTO workers (worker_id, name, ip, cpu_total, memory_total, status)
    VALUES ($1, $2, $3, $4, $5, 'active')
    ON CONFLICT (worker_id) DO UPDATE
      SET last_heartbeat = NOW()
  `, [workerId, workerName, ip, capacity.cpu, capacity.memory]);

  // 从 Portainer 获取环境信息
  const portainer = getPortainerClient();
  const env = await portainer.getEnvironments();
  const existing = env.find(e => e.Name === workerName);

  if (existing) {
    await db.query('UPDATE workers SET endpoint_id = $1 WHERE worker_id = $2', [
      existing.Id, workerId
    ]);
  }

  res.json({ success: true, registered: true });
});

// Worker 心跳端点
router.post('/workers/heartbeat', express.json(), async (req, res) => {
  const { workerId, stats } = req.body;

  await db.query(`
    UPDATE workers
    SET cpu_usage = $2,
        memory_usage = $3,
        last_heartbeat = NOW()
    WHERE worker_id = $1
  `, [workerId, stats.cpuUsage, stats.memoryUsage]);

  res.json({ success: true });
});
```

**场景 B (硬件盒子)**: ❌ 完全缺失

需要实现:

1. **Host Agent (硬件端)**
```typescript
// 缺失: 硬件盒子上运行的代理
// 运行在预装的 OpenClaw 盒子上

class HardwareAgent {
  async register() {
    // 出厂时调用一次
    const creds = this.loadCredentials();

    await fetch(`${CLOUD_URL}/api/devices/register`, {
      method: 'POST',
      body: JSON.stringify({
        deviceId: creds.deviceId,
        devicePassword: creds.devicePassword,
        model: 'OpenClaw Box v1',
      }),
    });
  }

  async pollBindingStatus() {
    // 定期查询是否被用户认领
    const response = await fetch(`${CLOUD_URL}/api/devices/${this.deviceId}/status`);
    const { claimed, userId, tunnelConfig } = await response.json();

    if (claimed) {
      await this.startTunnel(tunnelConfig);
      await this.startGateway();
    }
  }
}
```

2. **QR 码配网**
```typescript
// 缺失: 生成配网 QR 码
function generatePairingQR(deviceId: string): string {
  const payload = {
    deviceId,
    timestamp: Date.now(),
  };

  const signature = crypto
    .createHmac('sha256', DEVICE_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  const params = new URLSearchParams({
    ...payload,
    signature,
  });

  return `https://openclaw.app/device/pair?${params}`;
}
```

---

### 4. 完整用户使用流程（缺失）

#### 当前状态

**只有 API，没有用户界面**

```bash
# 用户需要:
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer MANUAL_TOKEN" \
  -d '{"email": "user@example.com"}'
```

#### 需要实现的完整流程

```
┌──────────────────────────────────────────────────────────────┐
│                    用户使用 OpenClaw 的完整流程                     │
└──────────────────────────────────────────────────────────────┘

1. 用户访问网站
   └─> https://openclaw.app
       └─> 显示首页 + 登录按钮

2. 点击登录
   └─> 选择 OAuth 提供商 (Google/GitHub/微信)
       └─> 跳转到 OAuth 授权页面
       └─> 用户授权
       └─> 回调到 /dashboard
       └─> 创建 session

3. 进入仪表板
   └─> 显示:
       - 用户信息
       - 现有租户列表
       - "创建新实例" 按钮
       - 资源使用统计

4. 点击 "创建新实例"
   └─> 显示表单:
       - 租户名称 (可选)
       - 计划选择 (free/basic/pro/enterprise)
       - 确认创建
       └─> 显示加载状态
       └─> 创建成功
       └─> 显示:
           - 访问地址: https://tenant-xxx.openclaw.app
           - Gateway Token
           - 管理按钮

5. 访问实例
   └─> 点击 "打开控制台"
       └─> 新标签页打开 tenant-xxx.openclaw.app
       └─> 进入 OpenClaw Web UI
```

---

## 需要补充的核心功能

### 优先级 P0 (必须)

1. **OAuth 2.0 集成**
   - [ ] 实现 OAuth 授权服务器
   - [ ] 添加 Google/GitHub/微信登录
   - [ ] 实现回调处理

2. **用户界面**
   - [ ] 登录页面
   - [ ] 用户仪表板
   - [ ] 创建租户界面

3. **Worker 自动注册**
   - [ ] Worker 注册 API
   - [ ] Worker 心跳 API
   - [ ] add-worker.sh 调用注册 API

### 优先级 P1 (重要)

4. **完善认证**
   - [ ] 用户注册流程
   - [ ] 密码重置
   - [ ] Token 刷新机制

5. **监控和日志**
   - [ ] 实现真正的 Prometheus 指标
   - [ ] 日志聚合 (Loki/ELK)

6. **用户文档**
   - [ ] 用户使用手册
   - [ ] API 文档
   - [ ] 故障排查指南

### 优先级 P2 (可选)

7. **硬件盒子支持**
   - [ ] Host Agent
   - [ ] QR 码配网
   - [ ] 设备预注册

---

## 总结

### 当前实现

✅ **已完成**:
- 租户管理核心 API
- Portainer 集成
- 调度器实现
- Docker 编排配置
- 单元测试框架

❌ **缺失关键功能**:
- OAuth 2.0 SSO 集成
- 用户 Web 界面
- Worker 自动注册
- 用户使用文档

### 下一步行动

1. **立即实施**: OAuth 2.0 集成
2. **立即实施**: 用户 Web 界面
3. **短期完善**: Worker 自动注册
4. **文档补充**: 用户使用指南

### 预计工作量

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| OAuth 集成 | 3-5 天 | P0 |
| 用户界面 | 5-7 天 | P0 |
| Worker 自动注册 | 1-2 天 | P0 |
| 文档编写 | 2-3 天 | P1 |
| 硬件盒子支持 | 10-15 天 | P2 |

是否继续实现缺失功能？
