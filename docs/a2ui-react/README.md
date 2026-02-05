# A2UI React H5 前端

OpenClaw A2UI 协议的 React H5 移动端实现。

## 概述

A2UI React 是基于 React 18+ 的 H5 移动端前端实现，完全兼容 OpenClaw A2UI v0.8/v0.9 消息协议。它提供了声明式的组件接口、主题系统和平台适配，可以在 iOS、Android 和纯 H5 环境中运行。

## 特性

- ✅ **完整的 A2UI 协议支持**: 兼容 v0.8/v0.9 消息格式
- ✅ **14+ A2UI 组件**: Button、Text、Card、TextField、Image 等
- ✅ **主题系统**: 支持深色/浅色模式自动切换
- ✅ **平台适配**: iOS、Android、纯 H5 自动检测和适配
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **性能优化**: React.memo、useMemo/useCallback 优化
- ✅ **桥接通信**: 支持 iOS/Android 原生桥接和 H5 后端通信

## 快速开始

### 开发模式

```bash
# 启动开发服务器 (http://localhost:18789)
pnpm a2ui:react:dev
```

### 生产构建

```bash
# 构建生产版本
pnpm a2ui:react:build

# 构建输出位置: dist/a2ui-react/
```

### 运行测试

```bash
# 运行测试
pnpm a2ui:react:test

# 运行测试覆盖率
pnpm a2ui:react:test:coverage
```

## 部署

### 与 Canvas Host 集成

A2UI React 已集成到 OpenClaw Canvas Host 中。启动 gateway 后访问：

```
http://gateway-host:18789/__openclaw__/a2ui/react
```

### 独立部署

构建产物可以直接部署到任何静态文件服务器：

```bash
# 构建后，将 dist/a2ui-react/ 目录部署到服务器
cp -r dist/a2ui-react/* /var/www/html/
```

## 使用指南

### 全局 API

```javascript
// 应用 A2UI 消息更新 UI
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [/* ... */]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'root'
    }
  }
]);

// 重置所有 Surface
await window.openclawA2UI.reset();

// 获取 Surface 列表
const surfaces = window.openclawA2UI.getSurfaces();
```

### 发送用户动作

```javascript
// 方式 1: 使用 OpenClaw.sendUserAction
OpenClaw.sendUserAction({
  name: 'button_click',
  surfaceId: 'main',
  context: {
    userId: '123',
    action: 'submit'
  }
});

// 方式 2: 直接使用组件的 action prop
// 在 A2UI 消息中定义:
{
  component: {
    Button: {
      text: { literalString: '点击' },
      action: {
        name: 'button_click',
        surfaceId: 'main',
        context: [
          { key: 'userId', value: { literalString: '123' } }
        ]
      }
    }
  }
}
```

## 组件列表

| 组件 | 描述 | 文档 |
|------|------|------|
| A2uiButton | 交互按钮 | [Button](#) |
| A2uiText | 文本显示 | [Text](#) |
| A2uiCard | 卡片容器 | [Card](#) |
| A2uiTextField | 文本输入 | [TextField](#) |
| A2uiImage | 图片显示 | [Image](#) |
| A2uiColumn | 垂直布局 | [Column](#) |
| A2uiRow | 水平布局 | [Row](#) |
| A2uiContainer | 容器 | [Container](#) |
| A2uiDivider | 分割线 | [Divider](#) |
| A2uiProgress | 进度条 | [Progress](#) |
| A2uiModal | 模态框 | [Modal](#) |
| A2uiMarkdown | Markdown 渲染 | [Markdown](#) |
| A2uiAudioPlayer | 音频播放器 | [AudioPlayer](#) |
| A2uiVideoPlayer | 视频播放器 | [VideoPlayer](#) |

## 主题定制

### 默认主题

```javascript
{
  colors: {
    primary: '#06b6d4',
    background: '#071016',
    surface: '#0f1720',
    text: '#ffffff'
  }
}
```

### 修改主题

可以通过修改 `src/canvas-host/a2ui-react/context/A2uiThemeContext.tsx` 中的 `darkTheme` 和 `lightTheme` 对象来自定义主题。

## 项目结构

```
src/canvas-host/a2ui-react/
├── components/          # React 组件
│   ├── elements/       # A2UI 基础组件
│   ├── feedback/       # 反馈组件 (Toast, Spinner)
│   └── surfaces/       # Surface 容器组件
├── context/            # React Context
│   ├── A2uiMessageContext.tsx    # 消息状态管理
│   ├── A2uiThemeContext.tsx      # 主题管理
│   └── A2uiActionContext.tsx     # 动作状态管理
├── services/           # 服务层
│   ├── messageAdapter.ts         # 消息适配器
│   └── bridgeAdapter.ts          # 桥接适配器
├── utils/              # 工具函数
├── types/              # TypeScript 类型定义
├── App.tsx             # 应用入口
└── index.ts            # 导出入口
```

## 技术栈

- **React 19**: UI 框架
- **TypeScript 5+**: 类型安全
- **Vite 6**: 构建工具
- **Vitest**: 测试框架
- **CSS Modules**: 样式隔离

## 浏览器支持

- iOS 13+
- Android 8+
- Chrome 80+
- Safari 13+

## 许可证

MIT
