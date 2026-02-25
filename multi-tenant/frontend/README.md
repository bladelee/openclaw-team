# OpenClaw Tenant Manager - Frontend

基于 Next.js 14 + shadcn/ui 的多租户管理系统前端界面。

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
# 租户管理 API 地址
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3001

### 4. 构建生产版本

```bash
pnpm build
pnpm start
```

## 功能

### 已实现

- **首页** (`/`) - 产品介绍和功能展示
- **登录** (`/login`) - 三种登录方式：
  - 开发环境快捷登录（Shared Secret）
  - OAuth 登录（Google/GitHub - 需要配置）
  - 密码登录（简化版，仅开发测试）
- **仪表板** (`/dashboard`) - 管理您的 OpenClaw 实例：
  - 查看实例列表
  - 创建新实例
  - 打开实例控制台
  - 重启实例
  - 删除实例
- **主机监控** (`/hosts`) - 查看 worker 主机状态

### 用户验收测试场景

#### 场景 1: 新用户首次使用（开发模式）

1. 访问 http://localhost:3001
2. 点击"进入仪表板"或"立即开始"
3. 在登录页选择"开发"标签
4. 输入用户 ID 和邮箱（或使用默认值）
5. 点击"一键登录并创建实例"
6. 系统自动创建实例并跳转到仪表板
7. 在仪表板查看新创建的实例
8. 点击"打开"按钮访问实例

#### 场景 2: 管理现有实例

1. 登录后进入仪表板
2. 查看实例列表
3. 点击"刷新"按钮获取最新状态
4. 点击实例的"重启"按钮重启实例
5. 点击"删除"按钮删除实例（需要确认）

#### 场景 3: 查看主机状态

1. 点击顶部工具栏的主机图标
2. 进入主机监控页面
3. 查看各主机的在线状态
4. 查看每个主机的资源使用情况（CPU、内存）
5. 查看每个主机上的租户数量

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI 组件**: shadcn/ui + Radix UI
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **数据请求**: React Query
- **表单**: React Hook Form + Zod
- **图标**: lucide-react
- **类型**: TypeScript

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   ├── login/              # 登录页
│   ├── dashboard/          # 仪表板
│   └── hosts/              # 主机监控
├── components/             # UI 组件
│   ├── ui/                 # shadcn 基础组件
│   ├── providers/          # React Query Provider
│   └── ...
├── lib/                    # 工具库
│   ├── api/                # API 客户端
│   ├── hooks/              # 自定义 Hooks
│   ├── stores/             # Zustand 状态
│   └── utils.ts            # 工具函数
├── types/                  # TypeScript 类型
│   ├── tenant.ts
│   ├── host.ts
│   └── auth.ts
└── styles/                 # 全局样式
    └── globals.css
```

## API 集成

### 认证方式

前端支持三种认证方式与后端通信：

1. **JWT Bearer Token** - 标准的 HTTP Authorization header
2. **Shared Secret** - 用于 SSO 集成的 HMAC 签名
3. **开发模式** - 自动生成签名进行快速测试

### 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/login` | 密码登录（简化版） |
| GET | `/api/auth/signature/:userId` | 生成签名 |
| POST | `/api/tenants` | 创建租户 |
| GET | `/api/tenants/me` | 获取当前用户租户 |
| DELETE | `/api/tenants/me` | 删除租户 |
| POST | `/api/tenants/me/restart` | 重启租户 |
| GET | `/api/hosts` | 获取所有主机 |

## 开发提示

### 添加新页面

1. 在 `src/app/` 下创建新目录和 `page.tsx`
2. 使用相同的布局结构

### 添加新 API 集成

1. 在 `src/lib/api/` 下创建或修改 API 函数
2. 在 `src/lib/hooks/` 下创建自定义 Hook
3. 使用 React Query 管理状态

### 添加新 UI 组件

```bash
# 使用 shadcn CLI 添加组件
npx shadcn-ui@latest add [component-name]
```

## 故障排查

### 1. CORS 错误

确保租户管理 API 的 CORS 配置正确：
- 允许来源: `http://localhost:3001`
- 允许 headers: `Authorization`, `X-User-ID`, `X-User-Email`, `X-User-Signature`

### 2. 认证失败

- 检查 `NEXT_PUBLIC_API_URL` 是否正确
- 查看浏览器控制台的网络请求
- 确认租户管理服务正在运行

### 3. 签名验证失败

- 确保前端和后端使用相同的 `SHARED_SECRET_KEY`
- 检查系统时间是否同步（签名有 5 分钟容差）
