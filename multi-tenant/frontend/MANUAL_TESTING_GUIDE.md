# OpenClaw Cloud 手工测试指南

> 日期: 2026-02-06
> 目的: 指导测试人员进行手工 UAT 测试

---

## 一、测试环境状态

### 当前运行服务

| 服务 | 地址 | 状态 | 说明 |
|------|------|------|------|
| **前端 Web UI** | http://localhost:3001 | ✅ 运行中 | Next.js 14 应用 |
| **租户管理 API** | http://localhost:3000 | ✅ 运行中 | Express API 服务 |
| **PostgreSQL 数据库** | localhost:5432 | ✅ 需确认 | 数据存储 |
| **Portainer** | http://localhost:9443 | ❌ 未运行 | **容器管理必需** |

### 环境依赖关系

```
用户请求 → Web UI (3001) → API (3000) → PostgreSQL (5432)
                                      ↓
                                  Portainer (9443) ← 容器创建必需
```

---

## 二、开发模式登录指南

### 登录方式

**选择"开发"标签页**，这是当前唯一可用的登录方式。

### 登录步骤

1. 访问 http://localhost:3001
2. 点击 **"进入仪表板"** 按钮
3. 在登录页面选择 **"开发"** 标签页
4. 填写或使用默认值：
   - **用户 ID**: `test-user-xxx`（自动生成的随机值，可自定义如 `alice`、`bob`）
   - **邮箱**: `dev@example.com`（可修改为任意邮箱）
5. 点击 **"一键登录并创建实例"**

### 登录原理

```
前端 → API /api/auth/signature/{userId}
      获取 HMAC-SHA256 签名
      ↓
前端 → API /api/tenants (带签名头部)
      X-User-ID, X-User-Email, X-User-Signature
      ↓
API 验证签名 → 创建租户 → 返回结果
```

---

## 三、可测试用例（无需 Portainer）

### 模块 1: 导航和布局 (5/5 可测试)

| 用例 ID | 场景 | 预期结果 | 状态 |
|---------|------|----------|------|
| NAV-01 | 访问首页 | 显示欢迎页面和功能介绍 | ✅ |
| NAV-02 | 点击"进入仪表板" | 跳转到登录页 | ✅ |
| NAV-03 | 登录页面布局 | 显示三个登录标签（开发/OAuth/密码） | ✅ |
| NAV-04 | 登录后跳转 | 成功后跳转到仪表板 | ✅ |
| NAV-05 | 顶部导航栏 | 显示用户信息、退出按钮 | ✅ |

### 模块 2: 开发模式登录 (3/3 可测试)

| 用例 ID | 场景 | 预期结果 | 状态 |
|---------|------|----------|------|
| LOGIN-DEV-01 | 使用默认值登录 | 成功登录，跳转到仪表板 | ✅ |
| LOGIN-DEV-02 | 自定义用户 ID | 使用自定义 ID（如 alice）登录 | ✅ |
| LOGIN-DEV-03 | 修改邮箱 | 使用自定义邮箱登录 | ✅ |

### 模块 3: 简化密码登录 (2/2 可测试)

| 用例 ID | 场景 | 预期结果 | 状态 |
|---------|------|----------|------|
| LOGIN-PWD-01 | 任意密码登录 | **注意：任何密码都能登录** | ⚠️ 仅开发测试 |
| LOGIN-PWD-02 | 邮箱格式验证 | 无效邮箱应显示错误 | ✅ |

**注意**: 简化密码登录仅用于开发测试，生产环境需要实现真实的密码哈希验证。

### 模块 4: UI 交互 (5/5 可测试)

| 用例 ID | 场景 | 预期结果 | 状态 |
|---------|------|----------|------|
| UI-01 | 按钮悬停效果 | 显示视觉反馈 | ✅ |
| UI-02 | 加载状态 | 登录时显示加载动画 | ✅ |
| UI-03 | 错误提示 | 登录失败显示错误信息 | ✅ |
| UI-04 | 响应式布局 | 不同屏幕尺寸正常显示 | ✅ |
| UI-05 | 深色模式 | 系统深色模式适配 | ✅ |

---

## 四、需要 Portainer 的用例

### 模块 5: 租户创建 (0/3 可测试 - ❌ 需要 Portainer)

| 用例 ID | 场景 | 预期结果 | 所需条件 |
|---------|------|----------|----------|
| TENANT-01 | 创建新租户 | 创建成功，显示实例信息 | Portainer 运行中 |
| TENANT-02 | 计划选择 | 不同计划有不同的资源配额 | Portainer 运行中 |
| TENANT-03 | 重复创建 | 同一用户重复创建应报错 | PostgreSQL |

### 模块 6: 租户管理 (0/4 可测试 - ❌ 需要 Portainer)

| 用例 ID | 场景 | 预期结果 | 所需条件 |
|---------|------|----------|----------|
| MGMT-01 | 查看实例列表 | 显示所有用户实例 | 有租户数据 |
| MGMT-02 | 重启实例 | 实例成功重启 | Portainer + Docker |
| MGMT-03 | 删除实例 | 实例成功删除，容器移除 | Portainer + Docker |
| MGMT-04 | 查看日志 | 显示容器日志 | Portainer + Docker |

### 模块 7: 实例访问 (0/2 可测试 - ❌ 需要 Portainer)

| 用例 ID | 场景 | 预期结果 | 所需条件 |
|---------|------|----------|----------|
| ACCESS-01 | 点击"打开"按钮 | 新标签页打开实例 | 容器运行中 |
| ACCESS-02 | 直接 URL 访问 | 通过 URL 直接访问 OpenClaw | 容器运行中 |

### 模块 8: 主机监控 (0/3 可测试 - ❌ 需要 Portainer)

| 用例 ID | 场景 | 预期结果 | 所需条件 |
|---------|------|----------|----------|
| HOST-01 | 查看主机列表 | 显示所有 Portainer 主机 | Portainer 配置 |
| HOST-02 | 资源使用情况 | 显示 CPU/内存使用率 | Portainer API |
| HOST-03 | 主机状态 | 显示在线/离线状态 | Portainer 连接 |

---

## 五、启用完整测试的方法

### 方法 1: 启动 Portainer（推荐用于完整测试）

#### 步骤

1. **安装 Docker**（如果未安装）
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```

2. **启动 Portainer 容器**
   ```bash
   docker volume create portainer_data
   docker run -d \
     -p 9443:9443 \
     --name portainer \
     --restart=unless-stopped \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -v portainer_data:/data \
     cr.portainer.io/portainer/portainer-ce:latest
   ```

3. **配置 Portainer**
   - 访问 https://localhost:9443
   - 创建管理员账号
   - 添加本地 Docker 环境
   - 生成 API Key

4. **更新 .env 配置**
   ```bash
   # 在 tenant-manager/.env
   PORTAINER_URL=http://localhost:9443
   PORTAINER_API_KEY=your_actual_api_key_here
   ```

5. **重启服务**
   ```bash
   cd /home/debian/moltbot/multi-tenant/tenant-manager
   pkill -f "tsx watch"
   pnpm dev
   ```

#### 验证
```bash
curl http://localhost:3000/api/hosts
# 应返回主机列表
```

### 方法 2: 使用 Mock Portainer（开发测试）

如果不想安装 Portainer，可以实现一个 Mock 服务：

```bash
# 创建简单的 mock 服务
cat > mock-portainer.js << 'EOF'
const express = require('express');
const app = express();

app.get('/api/endpoints', (req, res) => {
  res.json([{
    Id: 1,
    Name: 'local-mock',
    Type: 1,
    URL: 'tcp://localhost:2375',
    PublicURL: 'localhost:8080',
    Status: 1,
    StatusDescription: 'Up'
  }]);
});

app.get('/api/endpoints/1/docker/info', (req, res) => {
  res.json({
    NCPU: 4,
    MemTotal: 8 * 1024 * 1024 * 1024,
    MemUsed: 2 * 1024 * 1024 * 1024,
    ServerVersion: '20.10.0',
    Name: 'mock-host'
  });
});

app.listen(9443, () => console.log('Mock Portainer on :9443'));
EOF

node mock-portainer.js
```

---

## 六、当前测试建议

### 可以立即测试的内容

1. **UI/UX 验证**
   - 页面布局和响应式设计
   - 颜色方案和深色模式
   - 按钮和表单交互

2. **登录流程**
   - 开发模式一键登录
   - 登录后的页面跳转
   - 用户状态保持

3. **错误处理**
   - 网络错误提示
   - 表单验证
   - 加载状态显示

### 需要准备条件才能测试

1. **Portainer 配置** → 租户 CRUD 操作
2. **Docker 环境** → 容器创建和管理
3. **OpenClaw 镜像** → 实例实际运行

---

## 七、测试记录模板

| 日期 | 测试人员 | 用例 ID | 结果 | 备注 |
|------|----------|---------|------|------|
| 2026-02-06 | | NAV-01 | | |
| 2026-02-06 | | LOGIN-DEV-01 | | |

---

## 八、常见问题

### Q1: 登录后显示"创建实例失败"

**原因**: Portainer 未运行或未配置
**解决**: 按照"方法 1"启动 Portainer

### Q2: 主机监控页面显示错误

**原因**: 无法连接到 Portainer API
**解决**: 检查 .env 中的 PORTAINER_URL 和 PORTAINER_API_KEY

### Q3: 重启/删除按钮无效

**原因**: 没有实际的容器在运行
**解决**: 需要先成功创建租户（需要 Portainer）

---

## 九、测试环境检查清单

启动测试前，确认以下状态：

- [ ] PostgreSQL 运行在 5432 端口
- [ ] 前端运行在 3001 端口
- [ ] API 运行在 3000 端口
- [ ] Portainer 运行在 9443 端口（可选，用于完整测试）
- [ ] .env 文件配置正确
- [ ] 数据库表已创建

---

## 十、下一步

1. **立即测试**: UI 和登录流程
2. **配置 Portainer**: 启用完整功能测试
3. **执行 UAT**: 按照 UAT_CHECKLIST.md 进行系统测试
