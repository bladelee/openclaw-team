# 多租户实例管理 - 实现总结与验收测试

## 一、已实现功能总结

### 1. URL生成可配置化 (Phase 2) ✅

**实现位置**: `tenant-manager/src/config.ts`, `instance-service.ts`

**功能说明**:
- 支持通过环境变量配置实例URL生成规则
- 默认格式: `{name}.openclaw.app`
- 支持自定义scheme、baseDomain和format模板

**环境变量**:
```bash
INSTANCE_BASE_DOMAIN=openclaw.app      # 基础域名
INSTANCE_URL_FORMAT={name}.{baseDomain} # URL格式模板
INSTANCE_URL_SCHEME=https               # 协议 (http/https)
```

**代码实现**:
```typescript
// src/config.ts
export const configSchema = z.object({
  INSTANCE_BASE_DOMAIN: z.string().default('openclaw.app'),
  INSTANCE_URL_FORMAT: z.string().default('{name}.{baseDomain}'),
  INSTANCE_URL_SCHEME: z.string().default('https'),
  // ...
});

// src/instance-service.ts
export function generateInstanceUrl(instanceName: string): string {
  const format = config.INSTANCE_URL_FORMAT;
  const baseDomain = config.INSTANCE_BASE_DOMAIN;
  const scheme = config.INSTANCE_URL_SCHEME;

  let url = format
    .replace('{name}', instanceName)
    .replace('{baseDomain}', baseDomain);

  return `${scheme}://${url}`;
}
```

---

### 2. Chat抽屉功能 (Phase 3) ✅

**实现位置**: `frontend/src/components/chat/`, `frontend/src/components/ui/drawer.tsx`

**功能说明**:
- 右侧滑出式抽屉，宽度60%
- iframe嵌入OpenClaw Chat UI
- 支持新窗口打开
- 平滑动画过渡

**组件结构**:
```
frontend/src/components/
├── chat/
│   ├── ChatDrawer.tsx       # 主抽屉组件
│   ├── ChatButton.tsx       # Chat按钮
│   └── ChatIframe.tsx       # iframe封装
└── ui/
    └── drawer.tsx           # 通用抽屉组件 (shadcn/ui)
```

**关键代码**:
```tsx
// ChatDrawer.tsx
<Drawer
  open={open}
  onOpenChange={onOpenChange}
  direction="right"
  className="w-[60%]"  // 60%宽度
>
  <DrawerContent>
    <ChatIframe instanceUrl={instanceUrl} />
  </DrawerContent>
</Drawer>
```

**安全配置**:
```tsx
// ChatIframe.tsx
<iframe
  src={instanceUrl}
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
  allow="microphone; camera; clipboard-write"
  className="w-full h-full border-0"
/>
```

---

### 3. 自定义实例接入 (Phase 4) ✅

**实现位置**: `tenant-manager/src/routes.ts`, `tenant-manager/src/health-check.ts`

**功能说明**:
- 支持接入已部署的云端OpenClaw实例
- 支持接入本地硬件盒子
- 连接验证功能
- 健康检查机制

**数据库Schema扩展**:
```sql
-- migrations/003_add_custom_instance_fields.sql
ALTER TABLE instances ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'managed';
ALTER TABLE instances ADD COLUMN IF NOT EXISTS custom_url TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS health_check_url TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS health_check_interval INTEGER DEFAULT 60;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS is_healthy BOOLEAN;
CREATE INDEX IF NOT EXISTS idx_instances_source ON instances(source);
```

**类型定义**:
```typescript
export type InstanceSource = 'managed' | 'custom' | 'hardware';

export interface RegisterCustomInstanceInput {
  name: string;
  instanceType: 'cloud' | 'hardware';
  url?: string;           // 云端实例URL
  ip?: string;            // 硬件盒子IP
  port?: number;          // 硬件盒子端口 (默认18789)
  apiToken?: string;      // API Token (可选)
  healthCheckUrl?: string;
  healthCheckInterval?: number;
}
```

**API端点**:
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/instances/custom` | POST | 接入自定义实例 |
| `/api/instances/custom/:id/validate` | POST | 验证连接 |
| `/api/instances/:id/health` | GET | 健康检查 |

---

### 4. 硬件盒子支持 (Phase 5) ✅

**实现位置**: `tenant-manager/src/routes.ts`, `tenant-manager/src/health-check.ts`

**功能说明**:
- 支持通过IP:Port直接连接本地硬件盒子
- 自动生成访问URL: `http://{ip}:{port}`
- 健康检查与状态监控
- 离线状态处理

**UI差异化显示**:
```tsx
// dashboard/page.tsx
<div className="flex items-center gap-2 text-sm text-gray-500">
  <Badge variant={instance.source === 'hardware' ? 'default' : 'secondary'}>
    {instance.source === 'hardware' ? '硬件盒子' :
     instance.source === 'custom' ? '云端实例' : '托管实例'}
  </Badge>
  {instance.source === 'hardware' && instance.customUrl && (
    <span>({instance.customUrl})</span>
  )}
</div>
```

---

### 5. 实例信息增强 ✅

**实现位置**: `tenant-manager/src/instance-service.ts`

**新增返回字段**:
```typescript
export interface InstanceInfo {
  // 原有字段
  instanceId: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  url: string;
  status: string;
  containerId: string;
  containerName: string;
  host?: string;
  port?: number;
  createdAt: Date;

  // 新增字段
  source: InstanceSource;           // 实例类型
  customUrl?: string;               // 自定义URL (硬件盒子)
  healthCheckUrl?: string;          // 健康检查URL
  healthCheckInterval?: number;     // 检查间隔
  lastHealthCheck?: Date;           // 最后检查时间
  isHealthy?: boolean;              // 健康状态
}
```

---

## 二、验收测试用例

### 1. URL配置测试

#### TC-URL-001: 默认URL生成
**前置条件**: 环境变量使用默认配置

**步骤**:
1. 创建名为 `test-prod` 的实例
2. 查看生成的URL

**预期结果**: URL为 `https://test-prod.openclaw.app`

---

#### TC-URL-002: 自定义URL格式
**前置条件**: 设置环境变量 `INSTANCE_URL_FORMAT={baseDomain}/instance/{name}`

**步骤**:
1. 重启服务
2. 创建名为 `my-instance` 的实例
3. 查看生成的URL

**预期结果**: URL为 `https://openclaw.app/instance/my-instance`

---

#### TC-URL-003: 不同scheme
**前置条件**: 设置 `INSTANCE_URL_SCHEME=http`

**步骤**:
1. 重启服务
2. 创建实例
3. 查看生成的URL

**预期结果**: URL以 `http://` 开头

---

### 2. Chat抽屉测试

#### TC-CHAT-001: 打开Chat抽屉
**步骤**:
1. 登录Dashboard
2. 点击实例卡片上的[💬]按钮

**预期结果**:
- 右侧滑出抽屉
- 抽屉宽度为屏幕宽度的60%
- iframe加载OpenClaw Chat UI

---

#### TC-CHAT-002: 关闭Chat抽屉
**步骤**:
1. 打开Chat抽屉
2. 点击关闭按钮或抽屉外部区域

**预期结果**:
- 抽屉向右滑出关闭
- 页面恢复到原始状态

---

#### TC-CHAT-003: 新窗口打开
**步骤**:
1. 打开Chat抽屉
2. 点击"新窗口打开"按钮

**预期结果**:
- 在新标签页中打开OpenClaw Chat UI
- 原抽屉保持打开状态

---

#### TC-CHAT-004: iframe安全配置
**步骤**:
1. 打开Chat抽屉
2. 检查iframe元素

**预期结果**:
- sandbox属性包含正确的权限
- allow属性包含microphone、camera等

---

### 3. 自定义实例接入测试

#### TC-CUSTOM-001: 接入云端实例
**步骤**:
1. 点击"接入实例"按钮
2. 选择类型为"云端实例"
3. 输入名称: `my-cloud`
4. 输入URL: `https://my-claw.example.com`
5. 点击"验证连接"
6. 点击"接入"

**预期结果**:
- 验证连接成功
- 实例创建成功
- 实例类型显示为"云端实例"
- 可以正常打开Chat

---

#### TC-CUSTOM-002: 接入硬件盒子
**步骤**:
1. 点击"接入实例"按钮
2. 选择类型为"硬件盒子"
3. 输入名称: `local-hw`
4. 输入IP: `192.168.1.100`
5. 输入端口: `18789`
6. 点击"验证连接"
7. 点击"接入"

**预期结果**:
- 验证连接成功
- 实例创建成功
- 实例类型显示为"硬件盒子"
- customUrl为 `http://192.168.1.100:18789`

---

#### TC-CUSTOM-003: URL格式验证
**步骤**:
1. 尝试接入云端实例
2. 输入无效URL: `not-a-valid-url`

**预期结果**:
- 显示"Invalid URL format"错误
- 无法提交表单

---

#### TC-CUSTOM-004: 硬件盒子IP验证
**步骤**:
1. 尝试接入硬件盒子
2. 不输入IP地址

**预期结果**:
- 显示"IP address is required for hardware instances"错误
- 无法提交表单

---

#### TC-CUSTOM-005: 健康检查URL自定义
**步骤**:
1. 接入云端实例
2. 设置自定义健康检查URL: `https://example.com/api/health`

**预期结果**:
- 使用自定义URL进行健康检查
- `health_check_url` 字段正确保存

---

### 4. 健康检查测试

#### TC-HEALTH-001: 托管实例健康检查
**步骤**:
1. 查看托管实例状态

**预期结果**:
- 托管实例跳过健康检查
- is_healthy字段为null

---

#### TC-HEALTH-002: 自定义实例健康检查
**步骤**:
1. 接入自定义实例 (可访问的URL)
2. 等待健康检查执行

**预期结果**:
- `last_health_check` 字段更新
- `is_healthy` 为true
- status为'running'

---

#### TC-HEALTH-003: 离线实例检测
**步骤**:
1. 接入一个不可达的实例
2. 等待健康检查执行

**预期结果**:
- `last_health_check` 字段更新
- `is_healthy` 为false
- status为'stopped'

---

### 5. API测试

#### TC-API-001: GET /api/instances 返回完整字段
**步骤**:
1. 调用 `GET /api/instances` (带认证)
2. 检查响应

**预期结果**:
```json
{
  "instances": [
    {
      "instanceId": "instance-abc",
      "source": "hardware",
      "customUrl": "http://192.168.1.10:18789",
      "healthCheckUrl": null,
      "isHealthy": null,
      // ... 其他字段
    }
  ]
}
```

---

#### TC-API-002: POST /api/instances/custom 创建硬件实例
**步骤**:
```bash
curl -X POST http://localhost:3000/api/instances/custom \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "hw-test",
    "instanceType": "hardware",
    "ip": "192.168.1.100",
    "port": 18789
  }'
```

**预期结果**: 返回201状态码，实例创建成功

---

#### TC-API-003: POST /api/instances/custom 创建云端实例
**步骤**:
```bash
curl -X POST http://localhost:3000/api/instances/custom \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "cloud-test",
    "instanceType": "cloud",
    "url": "https://example.com"
  }'
```

**预期结果**: 返回201状态码，实例创建成功

---

### 6. UI显示测试

#### TC-UI-001: 实例类型显示
**步骤**:
1. 创建托管实例、云端实例、硬件盒子各一个
2. 查看Dashboard

**预期结果**:
- 托管实例显示"托管实例"标签
- 云端实例显示"云端实例"标签
- 硬件盒子显示"硬件盒子"标签及IP地址

---

#### TC-UI-002: 硬件盒子URL显示
**步骤**:
1. 创建硬件盒子实例
2. 查看实例卡片

**预期结果**: 显示格式为 `硬件盒子 (http://192.168.1.xxx:18789)`

---

#### TC-UI-003: 健康状态显示
**步骤**:
1. 创建自定义实例
2. 等待健康检查
3. 查看状态指示

**预期结果**:
- 健康实例显示绿色/在线状态
- 不健康实例显示红色/离线状态

---

## 三、文件变更清单

### 后端文件
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/config.ts` | 修改 | 添加URL配置schema |
| `src/database.ts` | 修改 | 添加自定义实例字段 |
| `src/instance-service.ts` | 修改 | 实现generateInstanceUrl，返回新增字段 |
| `src/routes.ts` | 修改 | 添加自定义实例API端点 |
| `src/health-check.ts` | 新建 | 健康检查服务 |
| `migrations/003_add_custom_instance_fields.sql` | 新建 | 数据库迁移 |

### 前端文件
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types/instance.ts` | 修改 | 扩展Instance类型 |
| `src/lib/api/instances.ts` | 修改 | 添加registerCustom方法 |
| `src/components/chat/ChatDrawer.tsx` | 新建 | Chat抽屉组件 |
| `src/components/chat/ChatButton.tsx` | 新建 | Chat按钮组件 |
| `src/components/chat/ChatIframe.tsx` | 新建 | iframe封装组件 |
| `src/components/ui/drawer.tsx` | 新建 | 通用抽屉组件 |
| `src/app/dashboard/page.tsx` | 修改 | 集成Chat抽屉和自定义实例表单 |

### 测试文件
| 文件 | 说明 |
|------|------|
| `src/config.test.ts` | 配置模块测试 |
| `src/instance-service.test.ts` | 实例服务测试 |
| `src/health-check.test.ts` | 健康检查测试 |
| `src/routes.test.ts` | API路由测试 |
| `frontend/src/components/chat/*.test.tsx` | Chat组件测试 |

---

## 四、部署注意事项

1. **数据库迁移**: 确保运行 `migrations/003_add_custom_instance_fields.sql`
2. **环境变量**: 根据需要配置URL相关环境变量
3. **CORS配置**: 如果使用Chat抽屉，确保OpenClaw实例允许Dashboard域名的CORS请求
4. **健康检查**: 考虑设置定期健康检查任务

---

## 五、已知限制

1. 局域网扫描功能未实现 (可选功能)
2. 自动重连机制未实现
3. 实例计划更新需要重新创建容器 (TODO)
4. 托管实例的健康检查通过容器状态获取，不进行HTTP检查
