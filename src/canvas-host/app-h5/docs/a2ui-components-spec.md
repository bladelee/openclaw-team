# 附录：A2UI 原有组件设计规范

> 本文档详细记录 A2UI React 的完整组件设计规范，确保新页面能够完全兼容原有风格。

## A2UI 组件库概览

### 组件列表
1. **A2uiButton** - 按钮
2. **A2uiCard** - 卡片容器
3. **A2uiText** - 文本显示
4. **A2uiColumn** - 垂直布局
5. **A2uiRow** - 水平布局
6. **A2uiTextField** - 文本输入框
7. **A2uiImage** - 图片
8. **A2uiDivider** - 分割线
9. **A2uiContainer** - 容器
10. **A2uiProgress** - 进度条
11. **A2uiModal** - 模态框
12. **A2uiVideoPlayer** - 视频播放器
13. **A2uiAudioPlayer** - 音频播放器
14. **A2uiMarkdown** - Markdown 渲染

### 反馈组件
15. **Toast** - 通知提示
16. **Status** - 状态指示器
17. **Spinner** - 加载动画

---

## 1. 主题系统

### 1.1 主题结构

```typescript
interface A2uiTheme {
  colors: {
    primary: string;          // 主色调 - #06b6d4 (青色)
    primaryAndroid: string;   // Android 主色
    primaryIOS: string;       // iOS 主色
    secondary: string;        // 次要色
    background: string;       // 背景色
    surface: string;         // 表面色
    text: string;             // 主文字色
    textSecondary: string;   // 次要文字色
    statusOk: string;         // 成功状态
    statusError: string;      // 错误状态
    statusWarning: string;    // 警告状态
  };
  platform: {
    android: {
      shadow: string;        // Android 阴影
      blur: string;           // Android 模糊效果
    };
    ios: {
      shadow: string;        // iOS 阴影
      blur: string;           // iOS 模糊效果
    };
  };
  components: {
    Button: ButtonStyle;
    Card: CardStyle;
    Text: TextStyle;
    TextField: TextFieldStyle;
  };
  cssVars: Record<string, string>; // CSS 变量映射
}
```

### 1.2 深色主题（默认）

```css
/* 主色调 */
--openclaw-primary: #06b6d4;           /* 青色 */
--openclaw-primary-android: #06b6d4;
--openclaw-primary-ios: #0891b2;

/* 背景色系 */
--openclaw-background: #071016;       /* 深蓝黑背景 */
--openclaw-surface: #0f1720;           /* 深色表面 */

/* 文字色 */
--openclaw-text: #ffffff;             /* 白色文字 */
--openclaw-text-secondary: #94a3b8;   /* 灰色文字 */

/* 状态色 */
--openclaw-status-ok: #10b981;         /* 成功 - 绿色 */
--openclaw-status-error: #ef4444;       /* 错误 - 红色 */
--openclaw-status-warning: #f59e0b;     /* 警告 - 黄色 */
```

### 1.3 浅色主题

```css
--openclaw-background: #ffffff;         /* 白色背景 */
--openclaw-surface: #f8fafc;             /* 浅灰表面 */
--openclaw-text: #1e293b;               /* 深色文字 */
--openclaw-text-secondary: #64748b;     /* 灰色文字 */
```

### 1.4 平台差异

**Android**
```css
box-shadow: 0 2px 10px rgba(6, 182, 212, 0.14);
backdrop-filter: blur(10px);
border-radius: 8px;
```

**iOS**
```css
box-shadow: 0 10px 25px rgba(6, 182, 212, 0.18);
backdrop-filter: blur(14px);
border-radius: 12px;
```

---

## 2. 基础组件规范

### 2.1 Button（按钮）

#### Props 定义
```typescript
interface ButtonProps {
  id: string;
  text: string;                    // 按钮文字
  action?: {                       // 点击动作
    name: string;
    surfaceId: string;
    context?: ContextValue[];
  };
  disabled?: boolean;              // 禁用状态
  style?: Record<string, unknown>; // 自定义样式
  weight?: number;                 // flex weight (用于布局)
}
```

#### 默认样式
```css
.a2ui-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  touch-action: manipulation;
}

/* Android 特定 */
.a2ui-button.android {
  background-color: var(--openclaw-primary-android);
  box-shadow: var(--openclaw-shadow-android);
}

/* iOS 特定 */
.a2ui-button.ios {
  background-color: var(--openclaw-primary-ios);
  box-shadow: var(--openclaw-shadow-ios);
}

/* 禁用状态 */
.a2ui-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}
```

#### 使用示例
```tsx
// 基础按钮
<A2uiButton
  id="submit-btn"
  text="提交"
  action={{ name: 'submit', surfaceId: 'main' }}
/>

// 禁用按钮
<A2uiButton
  id="disabled-btn"
  text="不可点击"
  disabled={true}
/>
```

---

### 2.2 Card（卡片）

#### Props 定义
```typescript
interface CardProps {
  id: string;
  children?: React.ReactNode;
  padding?: {
    literalNumber?: number;
    literalString?: string;
  };
  backgroundColor?: {
    literalString?: string;
  };
  borderRadius?: {
    literalNumber?: number;
    literalString?: string;
  };
  style?: Record<string, unknown>;
}
```

#### 默认样式
```css
.a2ui-card {
  padding: 16px;
  border-radius: 12px;
  background-color: rgba(15, 23, 32, 0.8);
  /* 背景带有 80% 不透明度的 surface 色 */
}

/* Hover 效果 */
.a2ui-card:hover {
  box-shadow: var(--openclaw-shadow-ios);
}
```

#### 使用示例
```tsx
// 基础卡片
<A2uiCard id="info-card" padding={{ literalNumber: 20 }}>
  <A2uiText id="title" text="卡片标题" size="large" weight="bold" />
  <A2uiText id="content" text="卡片内容..." size="medium" />
</A2uiCard>

// 自定义背景色
<A2uiCard
  id="accent-card"
  padding={{ literalString: "24px" }}
  backgroundColor={{ literalString: "rgba(6, 182, 212, 0.1)" }}
  borderRadius={{ literalNumber: 16 }}
>
  {/* 内容 */}
</A2uiCard>
```

---

### 2.3 Text（文本）

#### Props 定义
```typescript
interface TextProps {
  id: string;
  text: {
    literalString?: string;
    path?: string;  // 从上下文解析
  };
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
  surfaceId?: string;
  style?: Record<string, unknown>;
}
```

#### 字号映射
```css
/* 尺寸 */
.a2ui-text-small   { font-size: 14px; }
.a2ui-text-medium  { font-size: 16px; }
.a2ui-text-large   { font-size: 18px; }
.a2ui-text-xlarge  { font-size: 24px; }

/* 字重 */
.a2ui-text-normal    { font-weight: 400; }
.a2ui-text-medium    { font-weight: 500; }
.a2ui-text-semibold  { font-weight: 600; }
.a2ui-text-bold      { font-weight: 700; }
```

#### 使用示例
```tsx
// 标题
<A2uiText
  id="title"
  text={{ literalString: "大标题" }}
  size="xlarge"
  weight="bold"
  color="#ffffff"
/>

// 正文
<A2uiText
  id="description"
  text={{ literalString: "这是一段正文文字" }}
  size="medium"
/>

// 辅助文字（灰色）
<A2uiText
  id="caption"
  text={{ literalString: "辅助说明文字" }}
  size="small"
  color="#94a3b8"
/>

// 限制行数
<A2uiText
  id="clamped-text"
  text={{ literalString: "很长的文字会被截断..." }}
  maxLines={2}
/>
```

---

### 2.4 Column（垂直布局）

#### Props 定义
```typescript
interface ColumnProps {
  id: string;
  children?: React.ReactNode;
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  spacing?: {
    literalNumber?: number;
  };
  scrollable?: boolean;
  style?: Record<string, unknown>;
  weight?: number; // flex weight
}
```

#### 默认样式
```css
.a2ui-column {
  display: flex;
  flex-direction: column;
  gap: 16px; /* 默认间距 */
}

/* 对齐方式 */
.alignment-start   { align-items: flex-start; }
.alignment-center  { align-items: center; }
.alignment-end     { align-items: flex-end; }
.alignment-stretch { align-items: stretch; }

/* 滚动 */
.scrollable { overflow-y: auto; }
```

#### 使用示例
```tsx
// 基础垂直布局
<A2uiColumn id="form" spacing={{ literalNumber: 24 }}>
  <A2uiText id="label" text="字段标签" />
  <A2uiTextField id="input" placeholder="输入..." />
</A2uiColumn>

// 居中布局
<A2uiColumn id="centered" alignment="center">
  <A2uiText id="title" text="居中标题" />
  <A2uiButton id="btn" text="按钮" />
</A2uiColumn>

// 滚动容器
<A2uiColumn id="scroll-list" scrollable={true}>
  {items.map(item => (
    <A2uiCard key={item.id}>
      <A2uiText text={item.title} />
    </A2uiCard>
  ))}
</A2uiColumn>
```

---

### 2.5 Row（水平布局）

#### Props 定义
```typescript
interface RowProps {
  id: string;
  children?: React.ReactNode;
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  spacing?: {
    literalNumber?: number;
  };
  scrollable?: boolean;
  style?: Record<string, unknown>;
  weight?: number;
}
```

#### 默认样式
```css
.a2ui-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

/* 对齐方式 */
.alignment-start   { align-items: flex-start; }
.alignment-center  { align-items: center; }
.alignment-end     { align-items: flex-end; }
.alignment-stretch { align-items: stretch; }
```

#### 使用示例
```tsx
// 按钮组
<A2uiRow id="button-group" spacing={{ literalNumber: 12 }}>
  <A2uiButton id="cancel" text="取消" />
  <A2uiButton id="confirm" text="确认" />
</A2uiRow>

// 图标 + 文字
<A2uiRow id="icon-text" alignment="center" spacing={{ literalNumber: 8 }}>
  <Icon icon="star" />
  <A2uiText text="收藏" />
</A2uiRow>
```

---

### 2.6 TextField（输入框）

#### Props 定义
```typescript
interface TextFieldProps {
  id: string;
  label?: {
    literalString?: string;
  };
  placeholder?: {
    literalString?: string;
  };
  value?: {
    literalString?: string;
    path?: string;  // 从上下文绑定
  };
  disabled?: boolean;
  secret?: boolean;      // 密码输入
  multiline?: boolean;   // 多行文本
  style?: Record<string, unknown>;
}
```

#### 默认样式
```css
/* 输入框 */
.a2ui-textfield {
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(15, 23, 32, 0.8);
  font-size: 16px;
  color: #ffffff;
  border: 1px solid #1e293b;
}

/* Focus 状态 */
.a2ui-textfield:focus {
  outline: none;
  border-color: var(--openclaw-primary);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

/* 禁用状态 */
.a2ui-textfield:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 标签 */
.a2ui-textfield-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--openclaw-text);
}

/* 多行文本 */
.a2ui-textfield-multiline {
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
}
```

#### 使用示例
```tsx
// 带标签的输入框
<A2uiTextField
  id="email"
  label={{ literalString: "邮箱地址" }}
  placeholder={{ literalString: "your@email.com" }}
/>

// 密码输入
<A2uiTextField
  id="password"
  label={{ literalString: "密码" }}
  secret={true}
  placeholder={{ literalString: "输入密码..." }}
/>

// 多行文本
<A2uiTextField
  id="message"
  label={{ literalString: "消息内容" }}
  multiline={true}
  placeholder={{ literalString: "输入多行消息..." }}
/>
```

---

### 2.7 Modal（模态框）

#### Props 定义
```typescript
interface ModalProps {
  id: string;
  title?: {
    literalString?: string;
  };
  content?: {
    literalString?: string;
  };
  dismissible?: {
    literalBoolean?: boolean;
  };
  style?: Record<string, unknown>;
  onDismiss?: {
    name: string;
    surfaceId: string;
    context?: ContextValue[];
  };
}
```

#### 默认样式
```css
/* 遮罩层 */
.a2ui-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* 模态框内容 */
.a2ui-modal-content {
  background-color: var(--openclaw-surface);
  border-radius: 16px;
  max-width: 400px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--openclaw-shadow-ios);
}

/* 头部 */
.a2ui-modal-header {
  padding: 20px 20px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* 标题 */
.a2ui-modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--openclaw-text);
}

/* 内容区 */
.a2ui-modal-body {
  padding: 20px;
}

/* 文字 */
.a2ui-modal-text {
  margin: 0;
  font-size: 16px;
  color: var(--openclaw-text-secondary);
  line-height: 1.6;
}
```

#### 使用示例
```tsx
// 基础模态框
<A2uiModal
  id="confirm-modal"
  title={{ literalString: "确认操作" }}
  content={{ literalString: "确定要执行此操作吗？" }}
  dismissible={{ literalBoolean: true }}
  onDismiss={{
    name: 'cancel',
    surfaceId: 'main'
  }}
/>

// 带自定义样式
<A2uiModal
  id="custom-modal"
  title={{ literalString: "自定义标题" }}
  style={{ maxWidth: '500px' }}
>
  {/* 自定义内容 */}
</A2uiModal>
```

---

### 2.8 Divider（分割线）

#### Props 定义
```typescript
interface DividerProps {
  id: string;
  orientation?: 'horizontal' | 'vertical';
  thickness?: {
    literalNumber?: number;
  };
  color?: {
    literalString?: string;
  };
  style?: Record<string, unknown>;
}
```

#### 默认样式
```css
.a2ui-divider {
  border: none;
  margin: 16px 0;
}

/* 水平分割线 */
.a2ui-divider[orientation="horizontal"] {
  border-top: 1px solid #1e293b;
}

/* 垂直分割线 */
.a2ui-divider[orientation="vertical"] {
  width: 1px;
  height: 100%;
  border-left: 1px solid #1e293b;
}
```

---

### 2.9 Progress（进度条）

#### Props 定义
```typescript
interface ProgressProps {
  id: string;
  value?: {
    literalNumber?: number;
  };
  max?: {
    literalNumber?: number;
  };
  indeterminate?: boolean;
  style?: Record<string, unknown>;
}
```

#### 默认样式
```css
.a2ui-progress {
  height: 4px;
  background-color: var(--openclaw-surface);
  border-radius: 2px;
  overflow: hidden;
}

.a2ui-progress-bar {
  height: 100%;
  background-color: var(--openclaw-primary);
  transition: width 0.3s ease;
}

/* 不确定进度条动画 */
.a2ui-progress-indeterminate {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% { width: 0%; }
  50% { width: 60%; }
  100% { width: 100%; }
}
```

#### 使用示例
```tsx
// 确定进度
<A2uiProgress
  id="upload-progress"
  value={{ literalNumber: 70 }}
  max={{ literalNumber: 100 }}
/>

// 不确定进度
<A2uiProgress
  id="loading-progress"
  indeterminate={true}
/>
```

---

## 3. 反馈组件规范

### 3.1 Toast（通知）

#### 类型定义
```typescript
interface Toast {
  text: string;
  kind: 'ok' | 'error';
  expiresAt: number;
}
```

#### 样式
```css
.a2ui-toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.a2ui-toast {
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: toast-in 0.3s ease-out, toast-out 0.3s ease-in;
  animation-fill-mode: forwards;
}

/* 成功提示 */
.a2ui-toast-ok {
  background-color: rgba(16, 185, 129, 0.9);
  color: #ffffff;
}

/* 错误提示 */
.a2ui-toast-error {
  background-color: rgba(239, 68, 68, 0.9);
  color: #ffffff;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}
```

#### 使用示例
```tsx
import { ToastContainer } from './feedback/Toast';

// 显示提示
const toast = {
  text: '操作成功',
  kind: 'ok' as const,
  expiresAt: Date.now() + 3000
};

<ToastContainer toasts={[toast]} />;
```

---

### 3.2 Status（状态指示器）

#### 样式
```css
.a2ui-status {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: rgba(15, 23, 32, 0.9);
  border-radius: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 100;
}

.a2ui-status-text {
  font-size: 14px;
  color: var(--openclaw-text);
}

.a2ui-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--openclaw-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 4. 组件使用最佳实践

### 4.1 布局模式

#### 模式 A：卡片列表
```tsx
<A2uiColumn id="instance-list" spacing={{ literalNumber: 12 }}>
  {instances.map(instance => (
    <A2uiCard
      key={instance.id}
      id={`card-${instance.id}`}
      padding={{ literalNumber: 16 }}
    >
      <A2uiText
        id={`name-${instance.id}`}
        text={{ literalString: instance.name }}
        size="large"
        weight="bold"
      />
      <A2uiText
        id={`status-${instance.id}`}
        text={{ literalString: instance.status }}
        size="small"
        color="#94a3b8"
      />
    </A2uiCard>
  ))}
</A2uiColumn>
```

#### 模式 B：表单布局
```tsx
<A2uiColumn id="form" spacing={{ literalNumber: 24 }}>
  <A2uiTextField
    id="name"
    label={{ literalString: "实例名称" }}
    placeholder={{ literalString: "my-instance" }}
  />
  <A2uiTextField
    id="email"
    label={{ literalString: "邮箱地址" }}
    placeholder={{ literalString: "your@email.com" }}
  />
  <A2uiRow id="actions" alignment="center" spacing={{ literalNumber: 12 }}>
    <A2uiButton id="cancel" text="取消" />
    <A2uiButton id="submit" text="提交" />
  </A2uiRow>
</A2uiColumn>
```

#### 模式 C：卡片 + 操作
```tsx
<A2uiCard id="action-card" padding={{ literalNumber: 20 }}>
  <A2uiColumn spacing={{ literalNumber: 16 }}>
    <A2uiText
      id="title"
      text={{ literalString: "确认操作？" }}
      size="large"
      weight="semibold"
    />
    <A2uiText
      id="description"
      text={{ literalString: "此操作不可撤销" }}
      size="medium"
      color="#94a3b8"
    />
    <A2uiRow id="buttons" alignment="center" spacing={{ literalNumber: 12 }}>
      <A2uiButton id="cancel" text="取消" />
      <A2uiButton id="confirm" text="确认" />
    </A2uiRow>
  </A2uiColumn>
</A2uiCard>
```

### 4.2 间距规范

```typescript
// 间距常量
const SPACING = {
  xs: 4,    // 超小间距
  sm: 8,    // 小间距
  md: 12,   // 中等间距
  lg: 16,   // 大间距
  xl: 24,   // 超大间距
  xxl: 32,  // 巨大间距
};

// 使用示例
<A2uiColumn spacing={{ literalNumber: SPACING.lg }}>
  <div>内容 1</div>
  <div>内容 2</div>
</A2uiColumn>
```

### 4.3 响应式布局

```tsx
// 使用 weight 实现响应式
<A2uiRow id="responsive-row">
  <A2uiColumn id="left" weight={1}>
    <A2uiText text="左侧内容（占1份）" />
  </A2uiColumn>
  <A2uiColumn id="right" weight={2}>
    <A2uiText text="右侧内容（占2份）" />
  </A2uiColumn>
</A2uiRow>
```

---

## 5. 样式迁移指南

### 5.1 从 App-H5 迁移到 A2UI 风格

#### 旧代码（App-H5 风格）
```tsx
<div className="bg-white shadow-sm rounded-lg p-6">
  <h3 className="text-lg font-semibold text-gray-900">
    实例名称
  </h3>
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
    操作
  </button>
</div>
```

#### 新代码（A2UI 风格）
```tsx
<A2uiCard id="instance-card" padding={{ literalNumber: 24 }}>
  <A2uiText
    id="instance-name"
    text={{ literalString: "实例名称" }}
    size="large"
    weight="semibold"
  />
  <A2uiButton
    id="action-btn"
    text="操作"
    action={{ name: 'action', surfaceId: 'main' }}
  />
</A2uiCard>
```

### 5.2 CSS 类名映射

| Tailwind 类 | A2UI 等价 |
|---|---|
| 背景色 | 使用 CSS 变量 `var(--openclaw-background)` |
| `bg-white` | 不适用（使用 `bg-card`） |
| `bg-gray-50` | 使用 `var(--openclaw-background)` |
| `text-gray-900` | 使用 `var(--openclaw-text)` |
| `text-gray-600` | 使用 `var(--openclaw-text-secondary)` |
| `rounded-lg` | 使用 `border-radius: var(--radius-md)` |
| `shadow-sm` | 使用 `box-shadow: var(--openclaw-shadow-android)` |

---

## 6. 设计检查清单

在使用组件时，确保遵守以下规范：

- [ ] 使用 **CSS 变量**而不是硬编码颜色值
- [ ] 所有可交互元素支持 **touch manipulation**
- [ ] 所有文本使用 **A2uiText** 组件而不是原生 HTML
- [ ] 使用 **间距参数**而不是 margin 样式
- [ ] 卡片内容使用 **A2uiColumn/A2uiRow** 布局
- [ ] 表单输入使用 **A2uiTextField** 而不是原生 input
- [ ] 模态框使用 **A2uiModal** 而不是自定义 overlay
- [ ] 状态提示使用 **Toast** 而不是 alert

---

## 7. 组件库扩展

### 7.1 创建新组件指南

如果需要创建新组件，遵循以下步骤：

1. **定义 Props 接口**
2. **使用主题上下文** `useA2uiTheme()`
3. **应用平台样式差异** iOS vs Android
4. **支持自定义样式** `style` prop
5. **添加 CSS 类名** `a2ui-{component-name}`

#### 示例：创建新组件

```tsx
// A2uiBadge.tsx
import React from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';

interface BadgeProps {
  id: string;
  text: string;
  variant?: 'success' | 'error' | 'warning';
  style?: Record<string, unknown>;
}

export const A2uiBadge: React.FC<BadgeProps> = ({
  id,
  text,
  variant = 'success',
  style
}) => {
  const { theme } = useA2uiTheme();

  const colors = {
    success: theme.colors.statusOk,
    error: theme.colors.statusError,
    warning: theme.colors.statusWarning,
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: colors[variant],
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '500',
    ...style
  };

  return (
    <span id={id} className="a2ui-badge" style={badgeStyle}>
      {text}
    </span>
  );
};
```

---

## 8. 设计资源

### 8.1 文件路径
- **主题定义**: `/src/canvas-host/a2ui-react/context/A2uiThemeContext.tsx`
- **组件源码**: `/src/canvas-host/a2ui-react/components/elements/`
- **样式文件**: `/src/canvas-host/a2ui-react/styles/`
- **类型定义**: `/src/canvas-host/a2ui-react/types/index.ts`

### 8.2 参考文档
- A2UI 协议规范（如可用）
- 移动端设计规范
- 平台设计指南（iOS Human Interface Guidelines, Material Design）
