# 主题系统实现总结

## 概述

已为 App-H5 实现了完整的主题切换系统，支持三种主题风格：

### 1. **浅色主题（Light Theme）** - 默认
- 白色/浅灰背景
- 蓝色主色调（#3b82f6）
- 适合商务场景
- 类似原始 chat/settings 的清爽风格

### 2. **蓝色渐变主题（Blue Gradient Theme）**
- 深蓝色渐变背景
- 亮蓝色主色调
- 现代科技感
- 视觉冲击力强

### 3. **深色主题（Dark Theme）** - A2UI 原版
- 深蓝黑背景（#071016）
- 青色主色调（#06b6d4）
- 保留原 A2UI 设计

## 新增文件

### 1. 主题配置
**文件**: `/src/styles/theme.ts`

定义了三种主题的完整颜色系统：
- 背景色系
- 表面/卡片色系
- 主色调
- 文字色系（主要、次要、第三级）
- 状态色（成功、警告、错误、信息）
- 阴影系统

### 2. 主题 Context
**文件**: `/src/contexts/ThemeContext.tsx`

提供主题管理功能：
- `theme`: 当前主题类型
- `themeConfig`: 当前主题配置对象
- `setTheme()`: 切换主题方法

### 3. 主题 CSS
**文件**: `/src/styles/theme.css`

通过 CSS 类名应用主题变量：
- `.theme-light` - 浅色主题
- `.theme-blue` - 蓝色渐变主题
- `.theme-dark` - 深色主题

**CSS 变量列表**：
```css
--color-background           # 主背景
--color-surface              # 表面背景
--color-card                 # 卡片背景
--color-primary              # 主色
--color-primary-hover        # 主色悬停
--color-border               # 边框
--color-text                 # 主文字
--color-text-secondary       # 次要文字
--color-text-tertiary        # 第三级文字
--color-success              # 成功色
--color-warning              # 警告色
--color-error                # 错误色
--color-overlay              # 覆盖层
```

### 4. 主题辅助 Hook
**文件**: `/src/hooks/useThemeStyles.ts`

提供便捷的主题样式访问方法：
- `useThemeStyles()`: 获取主题样式的快捷对象
- `useCSSVar()`: 获取 CSS 变量值
- `CSSVars`: 常用 CSS 变量名常量

### 5. 主题切换组件
**文件**: `/src/components/ThemeSwitcher.tsx`

可视化的主题选择器：
- 三个主题卡片预览
- 点击切换主题
- 显示当前选中状态

## 已更新的组件

### 1. InstanceSettings.tsx ✅
- 已将所有硬编码颜色替换为 CSS 变量
- 添加了主题切换器
- 替换了 **58 处**颜色值

**使用方式**：
```tsx
import { useThemeStyles } from "../../../hooks/useThemeStyles";

const styles = useThemeStyles();

// 使用主题颜色
<div style={{ backgroundColor: "var(--color-surface)" }}>
<div style={{ color: "var(--color-text)" }}>
<button style={{ backgroundColor: "var(--color-primary)" }}>
```

### 2. App.tsx ✅
- 添加了 ThemeProvider
- 引入了 theme.css

### 3. 其他组件（待更新）
- InstanceDetailPage.tsx
- InstanceChat.tsx
- InstanceInfo.tsx
- BottomNav.tsx
- LoginPage.tsx
- InstancesPage.tsx

## 使用方法

### 在组件中应用主题

**方式 1: 使用 CSS 变量（推荐）**
```tsx
<div style={{
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)"
}}>
```

**方式 2: 使用 useThemeStyles Hook**
```tsx
import { useThemeStyles } from "../hooks/useThemeStyles";

function MyComponent() {
  const styles = useThemeStyles();

  return (
    <div style={{ ...styles.cardStyle }}>
      <h3 style={{ color: styles.text }}>标题</h3>
      <button style={{ ...styles.buttonStyle }}>
        按钮
      </button>
    </div>
  );
}
```

**方式 3: 使用 Tailwind + CSS 变量**
```tsx
<div className="bg-[var(--color-surface)] text-[var(--color-text)]">
```

### 添加主题切换器

在任何设置页面中添加：
```tsx
import { ThemeSwitcher } from "../components/ThemeSwitcher";

<div className="space-y-4">
  <h3>界面设置</h3>
  <ThemeSwitcher />
</div>
```

## 主题切换流程

1. 用户在设置中选择主题
2. `setTheme()` 被调用
3. 主题保存到 `localStorage["app-theme"]`
4. `applyThemeToDOM()` 更新 DOM 的 class
5. CSS 变量自动应用新值
6. 所有组件自动更新样式

## 批量更新组件的脚本

对于需要迁移的组件，可以使用以下脚本：

```bash
#!/bin/bash
FILE="your-component.tsx"

# 备份
cp "$FILE" "$FILE.bak"

# 替换背景色
sed -i 's/backgroundColor: "#071016"/backgroundColor: "var(--color-background)"/g' "$FILE"
sed -i 's/backgroundColor: "#0f1720"/backgroundColor: "var(--color-surface)"/g' "$FILE"
sed -i 's/backgroundColor: "#1e293b"/backgroundColor: "var(--color-card)"/g' "$FILE"

# 替换边框色
sed -i 's/border: "1px solid #1e293b"/border: "1px solid var(--color-border)"/g' "$FILE"
sed -i 's/border: "1px solid #334155"/border: "1px solid var(--color-border)"/g' "$FILE"

# 替换分隔线
sed -i 's/#1e293b"/var(--color-border)"/g' "$FILE"

# 替换文字色
sed -i 's/color: "#ffffff"/color: "var(--color-text)"/g' "$FILE"
sed -i 's/color: "#94a3b8"/color: "var(--color-text-tertiary)"/g' "$FILE"
sed -i 's/color: "#64748b"/color: "var(--color-text-disabled)"/g' "$FILE"

# 替换主色
sed -i 's/#06b6d4/var(--color-primary)/g' "$FILE"
sed -i 's/#3b82f6/var(--color-primary)/g' "$FILE"

# 替换状态色
sed -i 's/#ef4444/var(--color-error)/g' "$FILE"
sed -i 's/#10b981/var(--color-success)/g' "$FILE"
sed -i 's/#f59e0b/var(--color-warning)/g' "$FILE"

echo "替换完成"
```

## 测试清单

- [ ] 打开应用，默认显示浅色主题
- [ ] 进入实例详情 → 设置 → 界面设置
- [ ] 点击"蓝色渐变"，背景立即变为深蓝渐变
- [ ] 点击"深色主题"，背景变为深蓝黑色
- [ ] 刷新页面，主题选择保持不变
- [ ] 所有界面元素颜色正确适配
- [ ] 文字清晰可读
- [ ] 按钮和交互元素正常显示

## 待完成工作

### 高优先级
1. **更新 InstanceDetailPage.tsx**
   - Header 背景色
   - 按钮颜色
   - 更多菜单样式

2. **更新 InstanceChat.tsx**
   - 聊天背景色
   - 消息气泡颜色
   - 输入框样式

3. **更新 BottomNav.tsx**
   - 导航栏背景
   - 激活状态颜色

4. **更新 LoginPage.tsx**
   - 表单背景
   - 输入框样式
   - 按钮样式

### 中优先级
5. **更新 InstancesPage.tsx**
   - 卡片样式
   - 状态指示器

6. **更新 InstanceInfo.tsx**
   - 信息卡片样式

### 低优先级
7. **添加主题切换快捷入口**
   - 在底部导航栏添加主题按钮
   - 在个人中心添加主题设置

8. **优化动画效果**
   - 主题切换时添加过渡动画
   - 渐变背景的动画效果

## 主题变量速查表

| 用途 | CSS 变量 | 浅色主题值 | 蓝色主题值 | 深色主题值 |
|------|----------|-----------|-----------|-----------|
| 主背景 | `--color-background` | #f8fafc | #0f172a | #071016 |
| 表面 | `--color-surface` | #ffffff | #1e293b | #0f1720 |
| 卡片 | `--color-card` | #ffffff | rgba(30,41,59,0.8) | #1e293b |
| 主色 | `--color-primary` | #3b82f6 | #3b82f6 | #06b6d4 |
| 边框 | `--color-border` | #e2e8f0 | #334155 | #1e293b |
| 主文字 | `--color-text` | #1e293b | #ffffff | #ffffff |
| 次文字 | `--color-text-secondary` | #64748b | #cbd5e1 | #94a3b8 |
| 第三文字 | `--color-text-tertiary` | #94a3b8 | #94a3b8 | #64748b |
| 成功 | `--color-success` | #10b981 | #10b981 | #10b981 |
| 警告 | `--color-warning` | #f59e0b | #f59e0b | #f59e0b |
| 错误 | `--color-error` | #ef4444 | #ef4444 | #ef4444 |

## 常见问题

### Q: 为什么有些组件颜色没有变化？
A: 确保组件使用的是 CSS 变量而不是硬编码的颜色值。检查是否有 `style={{ color: "#xxx" }}` 这样的代码。

### Q: 主题切换后文字不可见？
A: 可能是文字颜色使用了硬编码的白色或黑色，需要改为使用 CSS 变量。

### Q: 蓝色渐变主题的渐变效果不明显？
A: 蓝色渐变主题在 `<html>` 元素上应用了渐变背景，确保 `applyThemeToDOM()` 函数被正确调用。

### Q: 如何添加新的主题？
A: 在 `/src/styles/theme.ts` 中添加新的主题配置，并在 `ThemeType` 类型中注册。

## 相关文件

- 主题配置: `/src/styles/theme.ts`
- 主题 Context: `/src/contexts/ThemeContext.tsx`
- 主题 CSS: `/src/styles/theme.css`
- 主题 Hook: `/src/hooks/useThemeStyles.ts`
- 主题切换器: `/src/components/ThemeSwitcher.tsx`
- 应用入口: `/App.tsx`

## 下一步

1. 完成所有组件的主题适配
2. 添加主题预览功能
3. 优化主题切换动画
4. 收集用户反馈，调整主题配色
