# OpenClaw H5 App

基于 React 的 H5 移动端应用，提供聊天和设置功能。

## 功能

- ✅ 实时聊天（WebSocket）
- ✅ Gateway 连接管理
- ✅ A2UI 渲染支持（Canvas 页面）
- ✅ 主题切换（浅色/深色/自动）
- ✅ 响应式设计
- ✅ 自动检测并显示 A2UI 内容
- 🚧 多媒体附件（开发中）
- 🚧 语音助手（开发中）

## 快速开始

### 开发模式

```bash
# 安装依赖
pnpm install

# 启动开发服务器（端口 18790）
pnpm app:h5:dev
```

### 生产构建

```bash
# 构建到 dist/app-h5/
pnpm app:h5:build
```

## 目录结构

```
app-h5/
├── pages/           # 页面组件
│   ├── chat/       # 聊天页面
│   ├── settings/   # 设置页面
│   └── canvas/     # Canvas/A2UI 页面（新增）
├── services/       # 业务服务
│   ├── gateway/    # Gateway WebSocket 连接
│   └── chat/       # 聊天服务
├── hooks/          # React Hooks
├── context/        # 全局状态管理
├── components/     # 通用 UI 组件
├── styles/         # 全局样式
└── utils/          # 工具函数
```

## 技术栈

- **UI 框架**: React 19
- **构建工具**: Vite 6
- **状态管理**: React Context + Hooks
- **样式**: CSS 变量 + 模块化 CSS
- **类型**: TypeScript 5+

## 配置

### Gateway 连接

默认连接到 `ws://localhost:18789`，可以在设置页面修改。

### 主题

支持三种主题模式：
- **自动**: 跟随系统主题
- **浅色**: 固定浅色主题
- **深色**: 固定深色主题

## A2UI 支持

### 自动显示 A2UI

当 AI 发送 A2UI 内容时，app-h5 会自动检测并切换到 Canvas 页面显示内容。

示例触发消息：
```
"显示一个按钮和进度条"
"创建一个表单界面"
```

### 手动访问 Canvas

点击聊天页面头部的 🎨 Canvas 按钮可以手动访问 Canvas 页面。

### A2UI 消息格式

A2UI 消息通过 Gateway WebSocket 的 `event: 'a2ui'` 事件发送，格式如下：

```json
{
  "type": "event",
  "event": "a2ui",
  "payload": {
    "surfaceId": "main",
    "messages": [
      { "surfaceUpdate": {...} },
      { "beginRendering": {...} }
    ]
  }
}
```

详见：[A2UI 消息触发场景分析](../../../docs/a2ui/A2UI消息触发场景分析.md)

## 开发计划

### Phase 1: Chat MVP ✅

- [x] 聊天页面
- [x] WebSocket 连接
- [x] 文本消息收发
- [x] 设置页面
- [x] 主题切换
- [x] Canvas/A2UI 页面
- [x] A2UI 消息自动检测和路由
- [x] A2UI React 集成

### Phase 2: 多媒体（开发中）

- [ ] 相机拍照
- [ ] 位置服务
- [ ] 文件上传
- [ ] 图片附件

### Phase 3: 语音助手（计划中）

- [ ] 语音输入
- [ ] 语音输出
- [ ] 对话 UI

## 注意事项

1. **WebSocket 连接**: 确保 Gateway 服务已启动（端口 18789）
2. **浏览器兼容**: 需要现代浏览器（Chrome、Firefox、Safari、Edge）
3. **HTTPS**: 生产环境建议使用 HTTPS（WebSocket 使用 WSS）

## 相关文档

- [设计文档](../../../docs/design/OpenClaw_H5移动端架构设计方案v2.md)
- [A2UI React H5](../a2ui-react/README.md)
