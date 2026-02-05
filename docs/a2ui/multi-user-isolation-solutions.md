# OpenClaw 多用户共享 Gateway 实例隔离机制与解决方案

## 核心问题

当多个用户共享同一个云端 Gateway 实例时：

```
┌─────────────────────────────────────────────────────────────────┐
│           云端 Gateway 实例（例如：10.0.1.12:18789）           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Gateway 进程                                   │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │         Embedded Agent（嵌入在 Gateway 中）          │ │ │
│  │  │  - pi-ai SDK                                         │ │ │
│  │  │  - 消息处理                                          │ │ │
│  │  │  - 工具执行                                          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                          ↑                                 │ │
│  │  ┌───────────────────────┴──────────────────────────────┐ │ │
│  │  │            会话管理（sessionKey 隔离）               │ │ │
│  │  │                                                       │ │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │ │
│  │  │  │User A    │  │User B    │  │User C    │         │ │ │
│  │  │  │sessionKey│  │sessionKey│  │sessionKey│         │ │ │
│  │  │  │user:a    │  │user:b    │  │user:c    │         │ │ │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘         │ │ │
│  │  └───────┼────────────┼────────────┼───────────────────┘ │ │
│  └──────────┼────────────┼────────────┼──────────────────────┘ │
│             │            │            │                        │
│  消息队列   │            │            │                        │
│             ▼            ▼            ▼                        │
│       不同的 Session Lane                                   │
└─────────────────────────────────────────────────────────────────┘

❓ 关键问题：
1. Agent 是共享的吗？
2. 用户数据如何隔离？
3. 文件系统如何隔离？
4. Agent 能看到其他用户的数据吗？
```

---

## OpenClaw 当前的隔离机制分析

### 1. Agent 运行架构

**结论：Agent 是共享的**

```typescript
// src/agents/pi-embedded-runner/run.ts

export async function runEmbeddedPiAgent(params: RunEmbeddedPiAgentParams) {
  // ...

  // ⚠️ 关键：Agent 运行在 Gateway 进程内
  // 多个用户共享同一个 Gateway 实例时
  // 他们共享同一个 Agent 运行时环境

  const resolvedWorkspace = resolveUserPath(params.workspaceDir);

  // Agent 使用指定的 workspaceDir
  // 但这个参数来自于请求配置
}
```

**架构图**：

```
Gateway 进程（单实例）
  │
  ├─ WebSocket Server（处理连接）
  │   ├─ User A 连接（sessionKey: "user:a"）
  │   ├─ User B 连接（sessionKey: "user:b"）
  │   └─ User C 连接（sessionKey: "user:c"）
  │
  └─ Embedded Agent（共享的运行时）
      ├─ 处理 User A 的请求（使用 workspace A）
      ├─ 处理 User B 的请求（使用 workspace B）
      └─ 处理 User C 的请求（使用 workspace C）
```

### 2. sessionKey 隔离机制

**结论：sessionKey 提供逻辑隔离**

```typescript
// src/agents/pi-embedded-runner/run.ts

export async function runEmbeddedPiAgent(params: RunEmbeddedPiAgentParams) {
  // 每个 sessionKey 有独立的并发控制队列
  const sessionLane = resolveSessionLane(params.sessionKey?.trim() || params.sessionId);

  // 全局队列（所有 session 共享）
  const globalLane = resolveGlobalLane(params.lane);

  // 会话级任务排队
  const enqueueSession = (task, opts) => enqueueCommandInLane(sessionLane, task, opts);
}
```

**隔离内容**：
- ✅ **消息历史**：每个 sessionKey 有独立的消息文件
- ✅ **并发队列**：每个 sessionKey 有独立的 SessionLane
- ✅ **会话状态**：每个 sessionKey 有独立的会话元数据

### 3. 工作区隔离机制

**结论：workspaceDir 提供文件系统隔离**

```typescript
// src/agents/workspace.ts

export function resolveDefaultAgentWorkspaceDir(): string {
  // 默认工作区：~/.openclaw/workspace
  return path.join(os.homedir(), ".openclaw", "workspace");
}

// 可以通过 OPENCLAW_PROFILE 环境变量指定不同的工作区
export function resolveDefaultAgentWorkspaceDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const profile = env.OPENCLAW_PROFILE?.trim();
  if (profile && profile.toLowerCase() !== "default") {
    // 不同的 profile 使用不同的工作区
    return path.join(homedir(), ".openclaw", `workspace-${profile}`);
  }
  return path.join(homedir(), ".openclaw", "workspace");
}
```

**关键问题**：
- ⚠️ 如果多个用户使用相同的 workspaceDir，他们会共享文件系统
- ⚠️ 需要为每个用户配置不同的 workspaceDir

### 4. 消息历史隔离

**结论：消息历史完全隔离**

```typescript
// Session 文件存储在 ~/.openclaw/sessions/ 目录
// 每个 sessionId（由 sessionKey 派生）有独立的文件

~/.openclaw/sessions/
  ├── user-a.json        // User A 的消息历史
  ├── user-b.json        // User B 的消息历史
  └── user-c.json        // User C 的消息历史
```

---

## 当前隔离机制总结

| 隔离维度 | 隔离方式 | 是否安全 |
|---------|---------|---------|
| **Agent 运行时** | 共享（嵌入在 Gateway 进程） | ⚠️ 需要注意 |
| **消息历史** | sessionKey 隔离（不同文件） | ✅ 完全隔离 |
| **并发队列** | sessionKey 隔离（SessionLane） | ✅ 逻辑隔离 |
| **文件系统** | workspaceDir 隔离 | ⚠️ 需要配置 |
| **API Token** | 配置级别隔离 | ⚠️ 需要配置 |
| **环境变量** | 进程级别 | ❌ 共享 |

---

## 安全风险分析

### 风险场景

**场景 1：文件系统访问**

```typescript
// User A 执行工具命令
await Agent.runTool("read_file", { path: "/home/user/openclaw/workspace/secret.txt" });

// ⚠️ 如果所有用户共享同一个 workspaceDir
// User A 可以读取 User B 的文件！
```

**场景 2：环境变量泄露**

```bash
# Gateway 进程的环境变量
OPENCLAW_API_KEY="sk-ant-xxx"  # 所有用户共享

# ⚠️ 如果一个用户执行 tool: env
# 他们可以看到所有环境变量
```

**场景 3：并发冲突**

```typescript
// User A 和 User B 同时执行工具
// 如果没有适当的队列隔离
// 可能出现资源竞争
```

---

## 解决方案

### 方案 1：每用户独立工作区（推荐）⭐⭐⭐⭐⭐

#### 原理

为每个用户分配独立的工作区目录，实现文件系统级别的隔离。

```
┌─────────────────────────────────────────────────────────────────┐
│                    工作区隔离结构                               │
│                                                                  │
│  /data/openclaw-workspaces/                                     │
│  ├── user-a/              ← User A 的工作区                      │
│  │   ├── workspace/                                             │
│  │   ├── sessions/                                              │
│  │   └── .openclaw/                                            │
│  │                                                              │
│  ├── user-b/              ← User B 的工作区                      │
│  │   ├── workspace/                                             │
│  │   ├── sessions/                                              │
│  │   └── .openclaw/                                            │
│  │                                                              │
│  └── user-c/              ← User C 的工作区                      │
│      ├── workspace/                                             │
│      ├── sessions/                                              │
│      └── .openclaw/                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 实施方式

**方式 A：通过 chat.send 参数动态指定**

```typescript
// 客户端发送请求时指定 workspaceDir

const response = await client.request('chat.send', {
  sessionKey: 'user:user-alice',
  message: 'Hello',
  workspaceDir: '/data/openclaw-workspaces/user-alice',  // ← 动态指定
});
```

**方式 B：通过环境变量 + Profile 机制**

```bash
# 为每个用户启动 Gateway 容器时设置不同的 OPENCLAW_PROFILE

# User A 的容器
docker run -d \
  -e OPENCLAW_PROFILE=user-alice \
  -v /data/workspaces/user-alice:/home/user/.openclaw \
  openclaw/gateway

# User B 的容器
docker run -d \
  -e OPENCLAW_PROFILE=user-bob \
  -v /data/workspaces/user-bob:/home/user/.openclaw \
  openclaw/gateway
```

**方式 C：通过配置文件**

```yaml
# ~/.openclaw/config.yml（多用户配置）

agents:
  defaults:
    workspaceRoot: "/data/openclaw-workspaces"

  # 为特定用户覆盖工作区
  profiles:
    user-alice:
      workspaceDir: "/data/openclaw-workspaces/user-alice"
    user-bob:
      workspaceDir: "/data/openclaw-workspaces/user-bob"
```

#### 后端实现

```typescript
// src/services/workspace-manager.ts

export class WorkspaceManager {
  /**
   * 为用户分配工作区目录
   */
  async assignUserWorkspace(userId: string): Promise<{
    workspaceDir: string;
    profile: string;
  }> {
    const profile = `user-${userId}`;
    const workspaceDir = `/data/openclaw-workspaces/${userId}`;

    // 创建工作区目录
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'workspace'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'sessions'), { recursive: true });

    // 创建 .openclaw 配置目录
    const openclawDir = path.join(workspaceDir, '.openclaw');
    await fs.mkdir(openclawDir, { recursive: true });

    // 创建基本配置文件
    const configFile = path.join(openclawDir, 'config.yml');
    await fs.writeFile(configFile, `
agents:
  defaults:
    workspaceDir: ${workspaceDir}/workspace
    model: claude-sonnet-4-5-20250514
`);

    return { workspaceDir, profile };
  }

  /**
   * 获取用户工作区
   */
  async getUserWorkspace(userId: string): Promise<string> {
    const workspaceDir = `/data/openclaw-workspaces/${userId}`;

    // 检查是否存在
    const exists = await fs.access(workspaceDir).then(() => true).catch(() => false);

    if (!exists) {
      // 首次使用，创建工作区
      const result = await this.assignUserWorkspace(userId);
      return result.workspaceDir;
    }

    return workspaceDir;
  }
}
```

#### API Gateway 集成

```typescript
// API 路由：为用户分配工作区

router.get('/api/openclaw/workspace', async (req, res) => {
  const user = await verifyOAuthToken(req.headers.authorization);
  const userId = user.userId;

  // 获取或创建用户工作区
  const workspaceManager = new WorkspaceManager();
  const { workspaceDir, profile } = await workspaceManager.getUserWorkspace(userId);

  res.json({
    workspaceDir,
    profile,
    userId,
  });
});
```

#### 客户端使用

```typescript
// 1. 获取用户工作区配置
const { workspaceDir } = await fetch('/api/openclaw/workspace', {
  headers: { 'Authorization': `Bearer ${oauthToken}` },
}).then(r => r.json());

// 2. 连接时使用工作区
const client = new GatewayBrowserClient({
  url: gatewayUrl,
  password: password,
  workspaceDir: workspaceDir,  // ← 使用用户专属工作区
});

// 3. 发送消息
await client.request('chat.send', {
  sessionKey: `user:${userId}`,
  message: 'Hello',
  // workspaceDir 会自动从配置读取
});
```

#### 优点

- ✅ 完全文件系统隔离
- ✅ 用户无法访问彼此的文件
- ✅ 相对简单实现
- ✅ 可选配额限制（磁盘使用量）

#### 缺点

- ⚠️ 需要为每个用户创建目录
- ⚠️ 磁盘使用量随用户数增长

---

### 方案 2：每用户独立 Gateway 容器（最安全）⭐⭐⭐⭐⭐

#### 原理

为每个用户启动独立的 Gateway 容器，实现进程级别的隔离。

```
┌─────────────────────────────────────────────────────────────────┐
│                    容器级隔离                                 │
│                                                                  │
│  Docker Host                                                     │
│  ├─ openclaw-user-alice-18789  ← User A 的容器                   │
│  │   └─ Gateway + Agent（独立进程）                             │
│  │                                                              │
│  ├─ openclaw-user-bob-18790    ← User B 的容器                   │
│  │   └─ Gateway + Agent（独立进程）                             │
│  │                                                              │
│  └─ openclaw-user-charlie-18791 ← User C 的容器                   │
│      └─ Gateway + Agent（独立进程）                             │
└─────────────────────────────────────────────────────────────────┘
```

#### 部署配置

**Docker Compose**:

```yaml
version: '3.8'

services:
  # User A 的 Gateway
  openclaw-user-alice:
    image: openclaw/gateway:latest
    container_name: openclaw-user-alice
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_PASSWORD=${ALICE_PASSWORD}
    volumes:
      - /data/openclaw-user-alice:/data
    restart: unless-stopped

  # User B 的 Gateway
  openclaw-user-bob:
    image: openclaw/gateway:latest
    container_name: openclaw-user-bob
    ports:
      - "18790:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_PASSWORD=${BOB_PASSWORD}
    volumes:
      - /data/openclaw-user-bob:/data
    restart: unless-stopped

  # User C 的 Gateway
  openclaw-user-charlie:
    image: openclaw/gateway:latest
    container_name: openclaw-user-charlie
    ports:
      - "18791:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_PASSWORD=${CHARLIE_PASSWORD}
    volumes:
      - /data/openclaw-user-charlie:/data
    restart: unless-stopped
```

**动态容器管理脚本**:

```typescript
// scripts/dynamic-container.ts

import Docker from 'dockerode';

const docker = new Docker();

export class GatewayContainerManager {
  /**
   * 为用户启动 Gateway 容器
   */
  async startUserContainer(userId: string, password: string): Promise<{
    containerId: string;
    port: number;
  }> {
    const containerName = `openclaw-user-${userId}`;
    const port = await this.getAvailablePort();

    // 创建容器
    const container = await docker.createContainer({
      Image: 'openclaw/gateway:latest',
      name: containerName,
      Env: [
        `OPENCLAW_GATEWAY_MODE=password`,
        `OPENCLAW_PASSWORD=${password}`,
        `OPENCLAW_PROFILE=user-${userId}`,
      ],
      ExposedPorts: {
        '18789/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          '18789/tcp': [{ HostPort: String(port) }],
        },
        Binds: [
          `/data/openclaw-${userId}:/data`,
        ],
      },
    });

    // 启动容器
    await container.start();

    // 保存到数据库
    await db.query(`
      INSERT INTO user_gateway_containers
      (user_id, container_id, container_name, port, status)
      VALUES (?, ?, ?, ?, 'running')
      ON DUPLICATE KEY UPDATE
        container_id = VALUES(container_id),
        port = VALUES(port),
        status = VALUES(status)
    `, [userId, container.id, containerName, port]);

    console.log(`[Container] Started container ${container.id} for user ${userId} on port ${port}`);

    return {
      containerId: container.id,
      port,
    };
  }

  /**
   * 停止用户容器
   */
  async stopUserContainer(userId: string): Promise<void> {
    const container = await docker.getContainer(`openclaw-user-${userId}`);
    await container.stop();
    await container.remove();

    // 更新数据库
    await db.query(`
      UPDATE user_gateway_containers
      SET status = 'stopped'
      WHERE user_id = ?
    `, [userId]);
  }

  /**
   * 获取可用端口
   */
  async getAvailablePort(startPort: number = 19000): Promise<number> {
    for (let port = startPort; port < 20000; port++) {
      const used = await db.query(`
        SELECT port FROM user_gateway_containers WHERE port = ? AND status = 'running'
      `, [port]);

      if (used.length === 0) {
        return port;
      }
    }

    throw new Error('No available ports');
  }

  /**
   * 检查容器状态
   */
  async checkContainerHealth(userId: string): Promise<{
    running: boolean;
    containerId?: string;
  }> {
    try {
      const container = await docker.getContainer(`openclaw-user-${userId}`);
      const info = await container.inspect();

      return {
        running: info.State.Running,
        containerId: container.id,
      };
    } catch {
      return { running: false };
    }
  }
}
```

#### 优点

- ✅ 进程级完全隔离
- ✅ 每个 Agent 独立运行
- ✅ 资源配额限制（CPU、内存）
- ✅ 容器故障不影响其他用户
- ✅ 易于监控和管理

#### 缺点

- ⚠️ 资源消耗高（每个用户一个容器）
- ⚠️ 端口管理复杂
- ⚠️ 启动时间较长

---

### 方案 3：工作区 + 沙盒隔离（高安全）⭐⭐⭐⭐

#### 原理

结合独立工作区和 Docker 沙盒，提供双层隔离。

```
┌─────────────────────────────────────────────────────────────────┐
│               工作区 + 沙盒双层隔离                            │
│                                                                  │
│  Gateway 进程（共享）                                           │
│  │                                                              │
│  ├─ User A 会话                                                  │
│  │   ├─ Workspace: /data/user-a/                               │
│  │   └─ Docker Sandbox: sandbox-user-a-xxx                    │
│  │                                                              │
│  ├─ User B 会话                                                  │
│  │   ├─ Workspace: /data/user-b/                               │
│  │   └─ Docker Sandbox: sandbox-user-b-yyy                    │
│  │                                                              │
│  └─ User C 会话                                                  │
│      ├─ Workspace: /data/user-c/                               │
│      └─ Docker Sandbox: sandbox-user-c-zzz                    │
└─────────────────────────────────────────────────────────────────┘
```

#### 配置

```yaml
# ~/.openclaw/config.yml

agents:
  defaults:
    workspaceRoot: "/data/openclaw-workspaces"
    # 启用 Docker 沙盒
    sandbox:
      mode: "docker"
      enabled: true

  # 为特定用户启用沙盒
  profiles:
    user-alice:
      workspaceDir: "/data/openclaw-workspaces/user-alice"
      sandbox:
        enabled: true
        image: "openclaw/sandbox:latest"
        memoryLimit: "512m"
        cpuQuota: 0.5
```

#### 实施步骤

**1. 配置 Docker 沙盒**

```bash
# 构建沙盒镜像
docker build -t openclaw/sandbox:latest -f docker/sandbox/Dockerfile

# 沙盒 Dockerfile 示例
FROM node:22-slim
RUN apt-get update && apt-get install -y \
    git curl vim build-essential \
    && rm -rf /var/lib/apt/lists/*
```

**2. Gateway 启动时启用沙盒**

```bash
# 启动 Gateway（启用沙盒）
openclaw gateway run \
  --bind 0.0.0.0 \
  --port 18789 \
  --config /path/to/config.yml
```

**3. 动态配置用户沙盒**

```typescript
// 为用户配置沙盒

async function configureUserSandbox(userId: string) {
  const workspaceDir = `/data/openclaw-workspaces/${userId}`;

  // 创建用户配置
  const userConfig = {
    agents: {
      defaults: {
        workspaceDir: `${workspaceDir}/workspace`,
      },
      sandbox: {
        mode: 'docker',
        enabled: true,
        workspaceDir: `${workspaceDir}/sandbox-workspace`,
        image: 'openclaw/sandbox:latest',
        memoryLimit: '512m',
        cpuQuota: 0.5,
      },
    },
  };

  // 保存到用户配置文件
  const configPath = path.join(workspaceDir, '.openclaw', 'config.yml');
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, YAML.stringify(userConfig));
}
```

#### 优点

- ✅ 工作区隔离（文件系统）
- ✅ 沙盒隔离（进程隔离）
- ✅ 资源限制（CPU、内存）
- ✅ 故障隔离（沙盒崩溃不影响 Gateway）

#### 缺点

- ⚠️ 复杂度高
- ⚠️ 性能开销（容器启动）
- ⚠️ 需要管理沙盒生命周期

---

### 方案 4：每用户独立 API Token（逻辑隔离）⭐⭐⭐

#### 原理

为每个用户生成独立的 API Token，用于认证 LLM 调用。

```yaml
# ~/.openclaw/config.yml

agents:
  defaults:
    model: claude-sonnet-4-5-20250514
    provider: anthropic

  # 为不同用户配置不同的 auth profile
  profiles:
    user-alice:
      authProfileId: "user-alice-anthropic"
    user-bob:
      authProfileId: "user-bob-anthropic"
```

**Auth Profile 存储**：

```bash
~/.openclaw/profiles/
├── user-alice-anthropic.json
│   {
│     "provider": "anthropic",
│     "apiKey": "sk-ant-user-alice-xxx"
│   }
└── user-bob-anthropic.json
    {
      "provider": "anthropic",
      "apiKey": "sk-ant-user-bob-yyy"
    }
```

#### 实施

```typescript
// src/services/api-key-manager.ts

export class ApiKeyManager {
  /**
   * 为用户分配 API Token
   */
  async assignUserApiKey(userId: string, provider: string = 'anthropic'): Promise<string> {
    const profileId = `user-${userId}-${provider}`;
    const apiKey = await this.generateApiKey();

    // 保存到 profile 文件
    const profilesDir = '/data/openclaw-profiles';
    await fs.mkdir(profilesDir, { recursive: true });

    const profileFile = path.join(profilesDir, `${profileId}.json`);
    await fs.writeFile(profileFile, JSON.stringify({
      provider,
      apiKey,
      createdAt: Date.now(),
      userId,
    }, null, 2));

    return apiKey;
  }

  /**
   * 生成 API Key
   */
  private async generateApiKey(): Promise<string> {
    // 调用 LLM 提供商的 API 创建密钥
    // 或者使用主密钥派生子密钥
    return `sk-ant-user-${crypto.randomUUID()}`;
  }

  /**
   * 为用户配置 auth profile
   */
  async configureUserAuthProfile(userId: string, apiKey: string) {
    const profileId = `user-${userId}-anthropic`;

    // 更新用户配置
    const userConfig = await this.getUserConfig(userId);
    userConfig.agents ??= {};
    userConfig.agents.profiles ??= {};
    userConfig.agents.profiles[profileId] = {
      provider: 'anthropic',
      apiKey,
    };
    userConfig.agents.defaults ??= {};
    userConfig.agents.defaults.authProfileId = profileId;

    await this.saveUserConfig(userId, userConfig);
  }
}
```

#### 优点

- ✅ API 使用隔离
- ✅ 成本追踪（每个用户的 LLM 成本）
- ✅ 配额管理

#### 缺点

- ⚠️ 需要管理多个 API Key
- ⚠️ 不隔离文件系统
- ⚠️ 需要与其他方案结合

---

### 方案 5：混合方案（推荐）⭐⭐⭐⭐⭐

#### 原理

结合独立工作区 + sessionKey 隔离 + 沙盒可选，实现最佳隔离。

```
┌─────────────────────────────────────────────────────────────────┐
│                    混合隔离方案                               │
│                                                                  │
│  隔离层级：                                                       │
│                                                                  │
│  L1: 会话隔离（sessionKey）                                     │
│      ├─ 消息历史隔离                                            │
│      ├─ 并发队列隔离                                            │
│      └─ 会话状态隔离                                            │
│                                                                  │
│  L2: 工作区隔离（workspaceDir）                                  │
│      ├─ 文件系统隔离                                            │
│      ├─ 配置文件隔离                                            │
│      └─ Session 文件隔离                                       │
│                                                                  │
│  L3: 沙盒隔离（可选，Docker）                                   │
│      ├─ 进程隔离                                                │
│      ├─ 资源限制                                                │
│      └─ 网络隔离                                                │
│                                                                  │
│  L4: API Token 隔离（可选）                                    │
│      ├─ LLM 调用隔离                                            │
│      └─ 成本追踪                                                │
└─────────────────────────────────────────────────────────────────┘
```

#### 实施

**1. 数据库设计**

```sql
-- 用户工作区表
CREATE TABLE user_workspaces (
  user_id VARCHAR(255) PRIMARY KEY,
  workspace_dir VARCHAR(512) NOT NULL,
  profile VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  disk_usage_bytes BIGINT DEFAULT 0,
  INDEX idx_user_id (user_id)
);

-- 用户沙盒表
CREATE TABLE user_sandboxes (
  user_id VARCHAR(255) PRIMARY KEY,
  sandbox_id VARCHAR(255) NOT NULL,
  container_id VARCHAR(255),
  status ENUM('running', 'stopped', 'error') DEFAULT 'stopped',
  memory_limit_mb INT DEFAULT 512,
  cpu_quota DECIMAL(3, 2) DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);
```

**2. 后端服务**

```typescript
// src/services/user-environment.ts

export class UserEnvironmentManager {
  /**
   * 为用户初始化完整的环境
   */
  async initializeUserEnvironment(userId: string, options: {
    enableSandbox?: boolean;
    assignApiKey?: boolean;
  } = {}): Promise<{
    workspaceDir: string;
    profile: string;
    sandbox?: {
      sandboxId: string;
      containerId: string;
    };
    apiKey?: string;
  }> {
    const result: any = {};

    // 1. 创建工作区
    const workspaceResult = await this.createUserWorkspace(userId);
    result.workspaceDir = workspaceResult.workspaceDir;
    result.profile = workspaceResult.profile;

    // 2. 可选：创建沙盒
    if (options.enableSandbox) {
      const sandboxResult = await this.createUserSandbox(userId, workspaceResult.workspaceDir);
      result.sandbox = sandboxResult;
    }

    // 3. 可选：分配 API Key
    if (options.assignApiKey) {
      const apiKey = await this.assignUserApiKey(userId);
      result.apiKey = apiKey;
    }

    // 4. 更新数据库
    await db.query(`
      INSERT INTO user_workspaces (user_id, workspace_dir, profile)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        workspace_dir = VALUES(workspace_dir),
        profile = VALUES(profile)
    `, [userId, result.workspaceDir, result.profile]);

    return result;
  }

  /**
   * 创建用户工作区
   */
  private async createUserWorkspace(userId: string): Promise<{
    workspaceDir: string;
    profile: string;
  }> {
    const workspaceDir = `/data/openclaw-workspaces/${userId}`;
    const profile = `user-${userId}`;

    // 创建目录结构
    await fs.mkdir(path.join(workspaceDir, 'workspace'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, '.openclaw'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, '.openclaw', 'profiles'), { recursive: true });

    // 创建配置文件
    const configFile = path.join(workspaceDir, '.openclaw', 'config.yml');
    await fs.writeFile(configFile, this.generateUserConfig(userId, workspaceDir));

    // 创建基本文件
    await this.createBootstrapFiles(workspaceDir);

    return { workspaceDir, profile };
  }

  /**
   * 创建用户沙盒
   */
  private async createUserSandbox(userId: string, workspaceDir: string): Promise<{
    sandboxId: string;
    containerId: string;
  }> {
    const sandboxId = `sandbox-${userId}`;
    const containerName = `openclaw-sandbox-${userId}`;

    // 创建沙盒工作区
    const sandboxWorkspace = path.join(workspaceDir, 'sandbox-workspace');
    await fs.mkdir(sandboxWorkspace, { recursive: true });

    // 启动 Docker 容器
    const docker = new Docker();
    const container = await docker.createContainer({
      Image: 'openclaw/sandbox:latest',
      name: containerName,
      Env: [
        `SANDBOX_USER=${userId}`,
        `SANDBOX_WORKSPACE=${sandboxWorkspace}`,
      ],
      HostConfig: {
        Binds: [
          `${sandboxWorkspace}:/workspace`,
        ],
        Memory: 512 * 1024 * 1024, // 512MB
        CpuQuota: 50000, // 50% CPU
      },
    });

    await container.start();

    // 保存到数据库
    const sandboxIdDb = crypto.randomUUID();
    await db.query(`
      INSERT INTO user_sandboxes (user_id, sandbox_id, container_id, status)
      VALUES (?, ?, ?, 'running')
    `, [userId, sandboxIdDb, container.id]);

    return {
      sandboxId: sandboxIdDb,
      containerId: container.id,
    };
  }

  /**
   * 生成用户配置
   */
  private generateUserConfig(userId: string, workspaceDir: string): string {
    return `
agents:
  defaults:
    workspaceDir: ${workspaceDir}/workspace
    model: claude-sonnet-4-5-20250514
    provider: anthropic
    authProfileId: user-${userId}-anthropic

  profiles:
  user-${userId}-anthropic:
    provider: anthropic
    # apiKey 会在运行时注入

  sandbox:
    enabled: true
    mode: docker
    workspaceDir: ${workspaceDir}/sandbox-workspace
    image: openclaw/sandbox:latest
    memoryLimit: 512m
    cpuQuota: 0.5
`;
  }

  /**
   * 创建启动文件
   */
  private async createBootstrapFiles(workspaceDir: string) {
    // IDENTITY.md
    await fs.writeFile(
      path.join(workspaceDir, 'workspace', 'IDENTITY.md'),
      `You are a helpful AI assistant.`
    );

    // AGENTS.md
    await fs.writeFile(
      path.join(workspaceDir, 'workspace', 'AGENTS.md'),
      `# Available Agents

## assistant
A helpful AI assistant.

## coder
An expert coding assistant.
`
    );
  }
}
```

**3. API 路由**

```typescript
// API：初始化用户环境

router.post('/api/openclaw/initialize', async (req, res) => {
  const user = await verifyOAuthToken(req.headers.authorization);
  const userId = user.userId;

  const options = req.body; // { enableSandbox, assignApiKey }

  const envManager = new UserEnvironmentManager();
  const result = await envManager.initializeUserEnvironment(userId, options);

  res.json({
    success: true,
    ...result,
  });
});
```

---

## 方案对比总结

| 方案 | 隔离级别 | 复杂度 | 资源消耗 | 安全性 | 推荐度 |
|------|---------|--------|---------|--------|--------|
| **独立工作区** | 文件系统 | 低 | 低 | 中 | ⭐⭐⭐⭐ |
| **独立容器** | 进程级 | 中 | 高 | 高 | ⭐⭐⭐⭐⭐ |
| **工作区 + 沙盒** | 进程级 | 高 | 中 | 高 | ⭐⭐⭐⭐ |
| **独立 API Token** | 逻辑 | 低 | 低 | 低 | ⭐⭐ |
| **混合方案** | 多层 | 中 | 中 | 高 | ⭐⭐⭐⭐⭐ |

---

## 最终推荐

### 对于云端容器场景（多用户共享）

**推荐：方案 1（独立工作区）+ sessionKey 隔离**

```yaml
推荐配置：
  ├─ 每用户独立工作区目录
  ├─ sessionKey 逻辑隔离
  ├─ 定期清理未使用工作区
  └─ 磁盘配额限制

原因：
  ✅ 平衡了隔离性和资源消耗
  ✅ 实现相对简单
  ✅ 适合多用户共享场景
  ✅ 用户完全看不到彼此的数据
```

### 对于本地盒子场景（单用户专属）

**推荐：默认工作区即可**

```yaml
推荐配置：
  ├─ 使用默认工作区 ~/.openclaw/workspace
  ├─ 无需额外隔离（单用户）
  └─ 可选启用 Docker 沙盒

原因：
  ✅ 单用户场景，无需复杂隔离
  ✅ 简化配置
  ✅ 降低资源消耗
```

---

## 实施建议

### 阶段 1：基础隔离（立即实施）

- [x] 为每个用户配置独立 workspaceDir
- [x] 使用 sessionKey 实现逻辑隔离
- [x] 定期清理未使用工作区

### 阶段 2：增强隔离（可选）

- [ ] 为高安全需求用户启用 Docker 沙盒
- [ ] 为每个用户分配独立的 API Token
- [ ] 实现磁盘配额限制

### 阶段 3：高级隔离（企业级）

- [ ] 为高价值用户提供独立容器
- [ ] 实现完整的资源配额管理
- [ ] 添加审计日志

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
