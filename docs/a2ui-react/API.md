# A2UI React API 文档

## 全局 API

### window.openclawA2UI

A2UI React 提供的全局 API，用于从外部控制 A2UI 界面。

#### applyMessages(messages: A2uiMessage[]): Promise<Result>

应用 A2UI 消息更新 UI。

**参数:**
- `messages`: A2UI 消息数组

**返回:**
```typescript
{
  ok: boolean;
  surfaces?: string[];
  error?: string;
}
```

**示例:**
```javascript
const result = await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: 'Hello World' },
              size: 'large'
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'title'
    }
  }
]);

console.log('Surface IDs:', result.surfaces);
```

#### reset(): Promise<Result>

重置所有 Surface，清空 UI。

**返回:**
```typescript
{
  ok: boolean;
  error?: string;
}
```

**示例:**
```javascript
await window.openclawA2UI.reset();
```

#### getSurfaces(): string[]

获取当前所有 Surface ID 列表。

**返回:** `string[]` - Surface ID 数组

**示例:**
```javascript
const surfaces = window.openclawA2UI.getSurfaces();
console.log('Active surfaces:', surfaces);
```

---

## window.OpenClaw

跨平台桥接 API，用于发送用户动作到原生/后端。

### OpenClaw.sendUserAction(userAction: UserAction): boolean

发送用户动作到原生或后端。

**参数:**
```typescript
interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}
```

**返回:** `boolean` - 发送是否成功

**示例:**
```javascript
const success = OpenClaw.sendUserAction({
  id: 'action-123',
  name: 'button_click',
  surfaceId: 'main',
  sourceComponentId: 'submit-btn',
  timestamp: new Date().toISOString(),
  context: {
    userId: '123',
    action: 'submit_form'
  }
});
```

### OpenClaw.postMessage(payload: unknown): boolean

底层桥接方法，直接发送消息。

**参数:**
- `payload`: 要发送的消息对象

**返回:** `boolean` - 发送是否成功

**示例:**
```javascript
OpenClaw.postMessage({
  userAction: {
    id: 'action-123',
    name: 'custom_event',
    // ...
  }
});
```

---

## A2UI 消息类型

### beginRendering

开始渲染一个 Surface。

```typescript
{
  beginRendering: {
    surfaceId: string;
    root: string;  // 根组件 ID
  }
}
```

### surfaceUpdate

更新 Surface 的组件。

```typescript
{
  surfaceUpdate: {
    surfaceId: string;
    components: Array<{
      id: string;
      component: {
        [ComponentType: string]: ComponentProps
      };
    }>;
  }
}
```

### dataModelUpdate

更新 Surface 的数据模型。

```typescript
{
  dataModelUpdate: {
    surfaceId: string;
    path: string;      // 数据路径，如 "/user" 或 "user"
    contents: Array<{
      key: string;
      valueString?: string;
      valueNumber?: number;
      valueBoolean?: boolean;
    }>;
  }
}
```

### deleteSurface

删除一个 Surface。

```typescript
{
  deleteSurface: {
    surfaceId: string;
  }
}
```

---

## 组件 Props 类型

### 通用值类型

```typescript
type Value =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { path: string };  // 数据模型路径
```

### Button 组件

```typescript
interface ButtonProps {
  id: string;
  text: string;
  action?: {
    name: string;
    surfaceId: string;
    context?: Array<{
      key: string;
      value: Value;
    }>;
  };
  disabled?: boolean;
  style?: Record<string, unknown>;
  weight?: number;
}
```

### Text 组件

```typescript
interface TextProps {
  id: string;
  text: Value;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
  surfaceId?: string;
}
```

### TextField 组件

```typescript
interface TextFieldProps {
  id: string;
  label?: Value;
  placeholder?: Value;
  value?: Value;
  disabled?: boolean;
  secret?: boolean;
  multiline?: boolean;
}
```

### Image 组件

```typescript
interface ImageProps {
  id: string;
  url: { literalString: string };
  alt?: { literalString?: string };
  width?: Value;
  height?: Value;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
}
```

---

## 事件类型

### openclaw:a2ui-action-status

动作状态变更事件，在原生/后端处理完用户动作后触发。

**事件数据:**
```typescript
{
  id: string;      // 对应 UserAction.id
  ok: boolean;
  error?: string;
}
```

**监听示例:**
```javascript
window.addEventListener('openclaw:a2ui-action-status', (event) => {
  const { id, ok, error } = event.detail;
  console.log(`Action ${id} result:`, ok ? 'success' : error);
});
```

---

## 主题 API

### useA2uiTheme()

获取主题和平台信息的 Hook。

```typescript
const { theme, platform, mode, setMode } = useA2uiTheme();

// theme: 当前主题对象
// platform: 'ios' | 'android' | 'unknown'
// mode: 'light' | 'dark' | 'auto'
// setMode: 切换模式函数
```

**主题结构:**
```typescript
interface A2uiTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  platform: {
    android: { shadow: string; blur: string };
    ios: { shadow: string; blur: string };
  };
  components: {
    Button: ButtonStyles;
    Card: CardStyles;
    // ...
  };
}
```

---

## 错误处理

### 常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `A2UI React not initialized` | React 应用未挂载 | 等待应用加载完成 |
| `Surface not found` | Surface ID 不存在 | 检查 surfaceId 是否正确 |
| `Invalid component type` | 不支持的组件类型 | 检查组件类型拼写 |

### 错误处理示例

```javascript
try {
  const result = await window.openclawA2UI.applyMessages(messages);
  if (!result.ok) {
    console.error('Failed to apply messages:', result.error);
  }
} catch (error) {
  console.error('Error applying messages:', error);
}
```
