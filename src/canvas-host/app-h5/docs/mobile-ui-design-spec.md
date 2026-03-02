# 移动 H5 端页面布局与风格设计文档

## 1. 设计方案 Review

### 1.1 原设计方案分析

#### 提出的设计方案
```
/instances/:instanceId  - 实例详情页
├─ Tab 1: Chat - 与该实例对话
├─ Tab 2: Settings - 配置该实例
└─ Tab 3: Info - 查看实例信息
```

#### 优点 ✅
1. **清晰的关联关系**：实例与 Chat/Settings 明确绑定
2. **符合用户心智模型**：每个实例 = 一个 Agent
3. **移动端友好**：底部 Tab 切换适合单手操作
4. **可扩展性好**：易于添加更多 Tab（Logs、Metrics 等）

#### 问题和改进建议 ⚠️

**1. Tab 切换与用户预期不匹配**
- **问题**：用户期望点击实例后直接进入 Chat，而不是看到一个 Tab 选择器
- **建议**：去掉 Tab，使用**层级导航**或**侧滑抽屉**

**2. Settings 不应该与 Chat 平级**
- **问题**：Settings 是低频操作，不应该占用宝贵的 Tab 空间
- **建议**：将 Settings 放入右上角菜单或通过"更多"按钮访问

**3. Info Tab 内容太少**
- **问题**：Info Tab 主要是静态信息，单独一页显得空
- **建议**：将 Info 信息整合到实例卡片中，或作为 Settings 的子页面

**4. 与原有风格冲突**
- **问题**：新设计使用浅色主题，与 a2ui 的深色主题不一致
- **建议**：采用 a2ui 的深色主题设计语言

---

## 2. 现有风格分析

### 2.1 App-H5 当前风格（多租户）

**色彩系统**
```css
背景色：bg-gray-50, bg-white
主色调：bg-blue-600 (#2563eb)
文字色：text-gray-900, text-gray-600
边框色：border-gray-200
```

**设计特点**
- ✅ 简洁现代的卡片式设计
- ✅ Tailwind CSS 工具类
- ✅ 清晰的视觉层次
- ❌ 浅色主题（与 a2ui 不一致）
- ❌ 缺乏科技感

### 2.2 A2UI 原有风格（Chat/Settings）

**色彩系统**
```css
--openclaw-background: #071016  /* 深蓝黑背景 */
--openclaw-surface: #0f1720      /* 深色表面 */
--openclaw-primary: #06b6d4     /* 青色主色 */
--openclaw-text: #ffffff        /* 白色文字 */
--openclaw-text-secondary: #94a3b8  /* 灰色文字 */
```

**设计特点**
- ✅ 深色主题，科技感强
- ✅ CSS 变量系统，易于主题化
- ✅ 移动优先，考虑 safe-area
- ✅ 平台适配（iOS/Android 样式差异）
- ✅ 组件化架构（Card、Button、Text 等）

---

## 3. 推荐设计方案

### 3.1 整体架构

```
├─ /instances                 # 实例列表（首页）
│   ├─ 顶部：标题 + 刷新 + 创建按钮
│   └─ 内容：实例卡片列表（深色主题）
│
├─ /instances/new             # 创建实例
│   └─ 表单页面（深色主题）
│
└─ /instances/:instanceId     # 实例详情（融合设计）
    ├─ 默认视图：Chat（全屏）
    ├─ 顶部栏：实例名 + 返回 + ⚙️ 设置 + ⋯ 更多
    ├─ 主区域：Chat 对话界面
    └─ 设置：通过模态框或抽屉访问
```

### 3.2 实例详情页设计（核心）

#### 布局结构

```
+------------------------------------------+
|  ← bladelee  🟢   ⚙️    ⋯             |  <- 顶部栏
+------------------------------------------+
|                                           |
|  ┌─────────────────────────────────┐    |
|  │  AI: 你好！我是你的助手...      │    |
|  │  📅 2024-02-28 14:30            │    |
|  └─────────────────────────────────┘    |
|                                           |
|  ┌─────────────────────────────────┐    |
|  │  User: 帮我写一个函数            │    |
|  │  ✏️ 编辑  🗑️ 删除              │    |
|  └─────────────────────────────────┘    |
|                                           |
|  ┌─────────────────────────────────┐    |
|  │  AI: 好的，这是代码...          │    |
|  │  📎 附件                        │    |
|  └─────────────────────────────────┘    |
|                                           |
|  ┌─────────────────────────────────┐    |
|  │  [输入框 - 发送消息]             │    |
|  └─────────────────────────────────┘    |
+------------------------------------------+
|  💬 聊天 | ⚙️ 设置 | 📊 信息 | 🔌 连接  |  <- 底部栏（可选）
+------------------------------------------+
```

#### 设计特点

1. **默认进入 Chat**：点击实例直接看到对话界面，符合用户预期
2. **顶部栏操作**：
   - ⚙️ 设置按钮 → 打开设置抽屉/模态框
   - ⋯ 更多按钮 → 快捷操作菜单
3. **底部栏可选**：提供快速切换，但不是主要导航方式
4. **手势支持**：右滑返回、下拉刷新等

### 3.3 设置页面设计

#### 抽屉式（推荐）

```
+------------------------------------------+
|  ⚙️ 实例设置              ✕ 关闭      |  <- 抽屉顶部
+------------------------------------------+
|  [基本信息]                               |
|  ├─ 实例名称: bladelee                   |
|  ├─ 实例类型: 云端实例                   |
|  └─ 状态: 在线 🟢                        |
|                                           |
|  [配置选项]                               |
|  ├─ 温度: 0.7 ━━━━━○━━━                |
|  ├─ 模型: GPT-4 ▼                       |
|  └─ 最大Token: 4096                     |
|                                           |
|  [危险操作]                               |
|  └─ 🗑️ 删除此实例                        |
+------------------------------------------+
```

#### 模态框式（备选）

```
┌───────────────────────────────────────┐
│  ⚙️ 实例设置                  [×]     │  <- 模态框
├───────────────────────────────────────┤
│  ...设置内容...                       │
│                                       │
│  [保存]              [删除实例]       │
└───────────────────────────────────────┘
```

---

## 4. 统一设计语言

### 4.1 色彩系统（采用 A2UI 深色主题）

```css
/* 主题色 - 使用 CSS 变量 */
:root {
  /* 背景色系 */
  --bg-primary: #071016;      /* 主背景 - 深蓝黑 */
  --bg-secondary: #0f1720;    /* 次级背景 - 深色表面 */
  --bg-tertiary: #1e293b;     /* 第三级背景 - 卡片 */

  /* 主色调 */
  --color-primary: #06b6d4;   /* 青色 - 主按钮、链接 */
  --color-primary-dark: #0891b2;  /* 青色 - 悬停状态 */

  /* 文字色 */
  --text-primary: #ffffff;     /* 主要文字 - 白色 */
  --text-secondary: #94a3b8;   /* 次要文字 - 灰色 */
  --text-tertiary: #64748b;    /* 辅助文字 - 更浅灰 */

  /* 状态色 */
  --color-success: #10b981;    /* 成功 - 绿色 */
  --color-error: #ef4444;      /* 错误 - 红色 */
  --color-warning: #f59e0b;    /* 警告 - 黄色 */
  --color-info: #3b82f6;       /* 信息 - 蓝色 */

  /* 边框色 */
  --border-color: #1e293b;     /* 边框 */
  --border-color-light: #334155; /* 浅边框 */

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* 阴影 */
  --shadow-sm: 0 2px 10px rgba(6, 182, 212, 0.14);
  --shadow-md: 0 10px 25px rgba(6, 182, 212, 0.18);
}
```

### 4.2 组件样式

#### 卡片（Card）
```css
.card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

#### 按钮（Button）
```css
/* 主按钮 */
.btn-primary {
  background: var(--color-primary);
  color: var(--text-primary);
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 16px;
}

/* 次要按钮 */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color-light);
  padding: 12px 24px;
  border-radius: var(--radius-sm);
}

/* 危险按钮 */
.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
```

#### 输入框（Input）
```css
.input {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 16px;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}
```

### 4.3 典型页面模板

#### 实例列表页面

```tsx
<div className="min-h-screen bg-primary">
  {/* 顶部栏 */}
  <header className="bg-secondary border-b border-border sticky top-0">
    <div className="px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-primary">我的实例</h1>
      <button className="btn-primary p-2 rounded-lg">
        <PlusIcon className="w-5 h-5" />
      </button>
    </div>
  </header>

  {/* 实例列表 */}
  <div className="px-4 py-4 space-y-3">
    {instances.map(instance => (
      <div key={instance.instanceId} className="card">
        {/* 实例卡片内容 */}
      </div>
    ))}
  </div>
</div>
```

#### 实例详情页面（Chat）

```tsx
<div className="min-h-screen bg-primary flex flex-col">
  {/* 顶部栏 */}
  <header className="bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <BackButton />
      <h1 className="text-lg font-semibold text-primary">
        {instance.name}
      </h1>
      <span className="w-2 h-2 rounded-full bg-success" />
    </div>
    <div className="flex items-center gap-2">
      <button className="btn-secondary p-2 rounded-lg">
        <SettingsIcon className="w-5 h-5" />
      </button>
      <button className="btn-secondary p-2 rounded-lg">
        <MoreIcon className="w-5 h-5" />
      </button>
    </div>
  </header>

  {/* Chat 区域 */}
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {/* 消息列表 */}
  </div>

  {/* 输入框 */}
  <div className="bg-secondary border-t border-border p-4">
    <input className="input w-full" placeholder="输入消息..." />
  </div>
</div>
```

---

## 5. 页面样式规范

### 5.1 页面布局模式

#### 模式 A：列表页（用于实例列表）
```
固定顶部栏
  └─ 标题 + 操作按钮
滚动内容区
  └─ 卡片列表（底部有 FAB）
```

#### 模式 B：详情页（用于实例 Chat）
```
固定顶部栏
  └─ 返回 + 标题 + 状态 + 操作按钮
滚动内容区
  └─ 全屏 Chat 界面
固定底部区（可选）
  └─ 输入框 + 快捷操作
```

#### 模式 C：表单页（用于创建实例）
```
固定顶部栏
  └─ 返回 + 标题
滚动内容区
  └─ 表单字段（步骤式）
固定底部区
  └─ 取消 + 确认按钮
```

### 5.2 间距规范

```css
/* 页面边距 */
.page-padding {
  padding-left: 16px;
  padding-right: 16px;
}

/* 卡片间距 */
.card-gap {
  margin-bottom: 12px;
}

/* 元素间距 */
.spacing-xs { margin-bottom: 8px; }
.spacing-sm { margin-bottom: 12px; }
.spacing-md { margin-bottom: 16px; }
.spacing-lg { margin-bottom: 24px; }
```

### 5.3 文字规范

```css
/* 标题 */
.title-lg {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.title-md {
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
}

/* 正文 */
.body-lg {
  font-size: 16px;
  line-height: 24px;
}

.body-md {
  font-size: 14px;
  line-height: 22px;
}

/* 辅助文字 */
.caption {
  font-size: 12px;
  line-height: 18px;
}
```

---

## 6. 交互设计

### 6.1 手势支持

```typescript
// 左右滑动切换
const swipeHandlers = {
  onSwipeLeft: () => console.log('打开设置'),
  onSwipeRight: () => console.log('返回上一页'),
};

// 下拉刷新
const refreshHandler = {
  onRefresh: async () => {
    await loadInstance();
  },
};

// 长按操作
const longPressHandler = {
  onLongPress: () => {
    showActionSheet();
  },
};
```

### 6.2 状态反馈

```typescript
// 加载状态
<LoadingSpinner />

// 成功提示
<Toast type="success" message="操作成功" />

// 错误提示
<Toast type="error" message="操作失败，请重试" />

// 确认对话框
<ConfirmDialog
  title="确定要删除此实例吗？"
  onConfirm={handleDelete}
/>
```

---

## 7. 响应式设计

### 7.1 断点规范

```css
/* 小屏手机 < 375px */
@media (max-width: 374px) {
  .card { padding: 12px; }
  .btn { padding: 10px 20px; }
}

/* 标准手机 375px - 428px */
@media (min-width: 375px) and (max-width: 428px) {
  /* 默认样式 */
}

/* 大屏手机/平板 > 428px */
@media (min-width: 429px) {
  .container { max-width: 428px; margin: 0 auto; }
}
```

### 7.2 Safe Area 支持

```css
/* 刘海屏适配 */
.page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## 8. 性能优化建议

### 8.1 图片优化

```tsx
// 使用现代图片格式
<picture>
  <source srcSet="image.avif" type="image/avif" />
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="描述" loading="lazy" />
</picture>
```

### 8.2 代码分割

```tsx
// 路由级别代码分割
const InstanceDetailPage = lazy(() => import('./InstanceDetailPage'));

// 组件级别代码分割
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### 8.3 状态管理优化

```tsx
// 使用 React.memo 优化渲染
export const InstanceCard = memo(({ instance }: Props) => {
  // ...
});

// 使用 useMemo 优化计算
const displayName = useMemo(() => {
  return instance.name || instance.instanceId;
}, [instance.name, instance.instanceId]);
```

---

## 9. 实施建议

### 9.1 分阶段实施

**第一阶段：基础样式统一**
1. 创建全局 CSS 变量文件
2. 更新所有页面使用深色主题
3. 统一按钮、卡片、输入框样式

**第二阶段：页面重构**
1. 实现实例列表页面（深色主题）
2. 实现实例详情页面（Chat 优先）
3. 添加设置抽屉/模态框

**第三阶段：交互优化**
1. 添加手势支持
2. 优化动画过渡
3. 添加加载状态和错误处理

### 9.2 技术栈

```json
{
  "样式": "CSS Variables + Tailwind CSS",
  "组件库": "自定义组件（基于 a2ui 风格）",
  "路由": "React Router v6",
  "状态管理": "React Context + Hooks",
  "动画": "CSS Transitions + Framer Motion (可选)",
  "图标": "Lucide React"
}
```

---

## 10. 设计资源

### 10.1 设计文件

- **Figma**: （如果有设计稿，在此链接）
- **图标库**: Lucide React
- **参考设计**:
  - A2UI 组件库: `/src/canvas-host/a2ui-react/`
  - PC 端设计: `/multi-tenant/frontend/src/app/dashboard/page.tsx`

### 10.2 开发资源

- **CSS 变量定义**: `/src/canvas-host/a2ui-react/styles/theme.css`
- **移动端样式**: `/src/canvas-host/a2ui-react/styles/mobile.css`
- **组件示例**: `/src/canvas-host/a2ui-react/components/`

---

## 11. 总结

### 11.1 核心设计原则

1. **统一视觉语言**：采用 a2ui 的深色主题
2. **内容优先**：Chat 优先，Settings 次之
3. **移动优先**：手势、动画、响应式
4. **性能优先**：代码分割、懒加载、优化渲染

### 11.2 关键改进

1. ✅ 去掉 Tab，使用层级导航
2. ✅ Settings 改为抽屉/模态框
3. ✅ 统一深色主题风格
4. ✅ 优化移动端交互体验

### 11.3 下一步行动

1. **Review 本设计**：团队讨论确认方案
2. **创建设计系统**：建立组件库和样式规范
3. **原型验证**：创建可交互原型进行用户测试
4. **分阶段实施**：按阶段逐步实现
