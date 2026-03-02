# 认证系统文档结构说明

> **更新日期**: 2025-02-26
> **状态**: 文档重组完成

---

## 文档归属划分

### OpenClaw 项目文档（`openclaw/docs/design/`）

以下文档维护在 OpenClaw 项目下，记录 OpenClaw 特定的需求和集成方案：

1. **auth-and-multihost-solution-summary.md**
   - 方案对比和选择记录
   - OpenClaw 项目的认证需求背景
   - 从 OpenClaw 视角的解决方案总结

2. **auth-integration-design.md**（新建）
   - app-h5 的详细集成实现
   - multi-tenant 的详细集成实现
   - OpenClaw 特定的 UI/UX 设计
   - 主机配置管理的具体实现
   - 离线支持实现
   - 自定义 Hooks 和组件实现

---

### Liuma 项目文档（`liuma/docs/auth/`）

以下文档维护在 Liuma 项目下，记录 Liuma 认证中心和 SDK 的设计与实现：

1. **unified-auth-center-design.md**
   - Liuma 后端 API 设计
   - 数据库 Schema 设计
   - OAuth 2.0 配置
   - 安全设计
   - API 参考文档

2. **auth-sdk-design.md**
   - SDK 核心架构
   - 类和接口设计
   - 存储适配器设计
   - 平台适配器设计
   - **通用的 SDK 使用指南**（适用于所有集成 SDK 的项目）
   - 开发指南和发布流程

3. **auth-implementation-plan.md**
   - 10周实施计划（完整项目）
   - Liuma 后端开发任务（Week 1-5）
   - OpenClaw 集成任务（Week 6-9）
   - 测试和部署（Week 10）
   - 监控系统设计

---

## 文档引用关系

```
openclaw/docs/design/
├── auth-and-multihost-solution-summary.md    (方案总结，OpenClaw 视角)
│   ├── 引用: ../../liuma/docs/auth/unified-auth-center-design.md
│   ├── 引用: ../../liuma/docs/auth/auth-sdk-design.md
│   ├── 引用: ../../liuma/docs/auth/auth-implementation-plan.md
│   └── 引用: ./auth-integration-design.md
│
└── auth-integration-design.md                (OpenClaw 集成实现)
    ├── 引用: ../../liuma/docs/auth/auth-sdk-design.md (通用 API)
    └── 引用: ../../liuma/docs/auth/unified-auth-center-design.md (API 规范)

liuma/docs/auth/
├── unified-auth-center-design.md             (Liuma 后端设计)
├── auth-sdk-design.md                        (SDK 设计 + 通用使用指南)
│   ├── 引用: ./auth-implementation-plan.md
│   ├── 引用: ./unified-auth-center-design.md
│   └── 引用: ../../openclaw/docs/design/auth-integration-design.md (OpenClaw 示例)
│
└── auth-implementation-plan.md               (完整实施计划)
    ├── 引用: ./unified-auth-center-design.md
    ├── 引用: ./auth-sdk-design.md
    └── 引用: ../../openclaw/docs/design/auth-integration-design.md
```

---

## 使用指南

### 对于 OpenClaw 开发者

1. **了解项目需求和方案选择**
   - 阅读 `openclaw/docs/design/auth-and-multihost-solution-summary.md`

2. **实施 app-h5 和 multi-tenant 集成**
   - 阅读 `openclaw/docs/design/auth-integration-design.md`
   - 参考 `liuma/docs/auth/auth-sdk-design.md` 了解 SDK API

3. **了解整体进度**
   - 阅读 `liuma/docs/auth/auth-implementation-plan.md` 查看任务清单

### 对于 Liuma 开发者

1. **开发 Liuma 后端**
   - 阅读 `liuma/docs/auth/unified-auth-center-design.md`
   - 参考 `liuma/docs/auth/auth-implementation-plan.md` Week 1-3 任务

2. **开发 @liuma/auth-sdk**
   - 阅读 `liuma/docs/auth/auth-sdk-design.md`
   - 参考 `liuma/docs/auth/auth-implementation-plan.md` Week 4-5 任务

3. **了解 SDK 使用场景**
   - 参考 `openclaw/docs/design/auth-integration-design.md` 中的实际集成示例

### 对于第三方集成者

1. **了解 Liuma 认证中心**
   - 阅读 `liuma/docs/auth/unified-auth-center-design.md`

2. **集成 @liuma/auth-sdk**
   - 阅读 `liuma/docs/auth/auth-sdk-design.md` 的使用指南部分
   - 参考 `openclaw/docs/design/auth-integration-design.md` 中的实现示例

---

## 文档维护规则

### OpenClaw 项目文档

- **负责人**：OpenClaw 团队
- **更新内容**：OpenClaw 特定的需求变更、UI/UX 调整、集成实现细节
- **不更新内容**：SDK 核心功能、Liuma 后端 API

### Liuma 项目文档

- **负责人**：Liuma 团队
- **更新内容**：Liuma 后端 API 变更、SDK 核心功能、通用使用指南
- **不更新内容**：OpenClaw 特定的 UI/UX 实现

---

## 文档迁移记录

### 2025-02-26 重组

**新建文档**：
- `openclaw/docs/design/auth-integration-design.md`

**更新文档**：
- `openclaw/docs/design/auth-and-multihost-solution-summary.md`
  - 更新文档引用，区分 OpenClaw 和 Liuma 文档
- `openclaw/docs/design/auth-sdk-design.md`
  - 简化 OpenClaw 特定内容
  - 添加指向 `auth-integration-design.md` 的引用
- `openclaw/docs/design/auth-implementation-plan.md`
  - 更新文档使用指南
  - 添加文档位置说明

**待移动文档**（需手动移动到 liuma 项目）：
- `unified-auth-center-design.md` → `../liuma/docs/auth/`
- `auth-sdk-design.md` → `../liuma/docs/auth/`
- `auth-implementation-plan.md` → `../liuma/docs/auth/`

---

## 下一步操作

1. **手动移动文档到 Liuma 项目**
   ```bash
   cd /home/ubuntu/proj/openclaw/docs/design
   mv unified-auth-center-design.md ../liuma/docs/auth/
   mv auth-sdk-design.md ../liuma/docs/auth/
   mv auth-implementation-plan.md ../liuma/docs/auth/
   ```

2. **验证文档引用**
   - 检查所有相对路径是否正确
   - 确认跨项目文档链接可访问

3. **更新 Git 仓库**
   - 提交 OpenClaw 文档变更
   - 在 Liuma 仓库提交新文档
