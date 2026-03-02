# 移动 H5 端实例-聊天-设置融合设计文档

## 设计理念

每个实例就是一个独立的 Agent，Chat 和 Settings 都应该针对特定实例，而不是全局功能。

## 当前问题分析

### 现有设计缺陷

1. **实例、聊天、设置分离**：
   - `/instances` - 实例列表
   - `/chat` - 全局聊天（未绑定实例）
   - `/settings` - 全局设置（未绑定实例）

2. **用户困惑**：
   - 不知道在跟哪个实例聊天
   - 设置是针对哪个实例的
   - 实例和 Chat/Settings 的关系不明确

### PC 端设计参考

从 PC 端的实现可以看到：

1. **Dashboard 页面**：
   - 显示所有实例卡片
   - 每个实例有操作按钮：Chat、打开、重启、删除

2. **Chat 功能**：
   - 使用 Drawer 侧边栏
   - Iframe 加载实例的 `/chat` 路径
   - 传入 `instanceUrl` 和 `instanceName`

3. **实例管理**：
   - "打开"按钮在新标签页打开实例完整界面
   - 实例内部的设置在实例自身管理

## 新设计方案

### 1. 页面架构

```
/instances                    # 实例列表页（首页）
/instances/new                # 创建实例页
/instances/:instanceId        # 实例详情页 = Chat + Settings 融合
```

### 2. 实例详情页设计（核心创新）

**URL**: `/instances/:instanceId`

这是核心页面，融合了 Chat 和 Settings 功能：

#### 页面布局（移动端）

```
+--------------------------------------+
|  ← bladelee              ⚙️  🔍     |  <- 顶部栏
+--------------------------------------+
|                                      |
|  [聊天区域 - 消息列表]                |
|                                      |
|  AI: 你好！我是你的助手...           |
|  User: 帮我写一个函数                |
|  AI: 好的，这是代码...              |
|                                      |
|  [输入框 - 发送消息]                  |
|                                      |
+--------------------------------------+
|  [底部 Tab 切换]                      |
|  💬 Chat | ⚙️ Settings | 📊 Info   |
+--------------------------------------+
```

#### Tab 1: Chat（默认显示）
- 实例的对话界面
- 绑定到当前实例
- 加载实例的聊天历史（如果实例支持）

#### Tab 2: Settings（实例设置）
- 实例名称编辑
- 实例配置（温度、模型等，如果实例 API 支持）
- 健康检查状态
- 删除实例按钮

#### Tab 3: Info（实例信息）
- 实例类型（托管/云/硬件）
- 访问地址/URL
- 创建时间
- 状态信息

### 3. 导航流程

```
用户登录
   ↓
实例列表页 (/instances)
   ↓
   ├─→ 点击"创建" → 创建实例页 (/instances/new)
   │                ↓
   │             创建成功，返回列表
   │
   └─→ 点击实例卡片 → 实例详情页 (/instances/:instanceId)
                      ↓
                   [Chat Tab] - 默认，与该实例对话
                      |
                   [Settings Tab] - 配置该实例
                      |
                   [Info Tab] - 查看实例信息
```

### 4. 路由配置

```typescript
// App.tsx
<Routes>
  <Route path="/instances" element={<InstancesPage />} />
  <Route path="/instances/new" element={<CreateInstancePage />} />
  <Route path="/instances/:instanceId" element={<InstanceDetailPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="*" element={<Navigate to="/instances" replace />} />
</Routes>
```

### 5. 状态管理

```typescript
// contexts/InstanceContext.tsx
interface InstanceContextType {
  currentInstance: Instance | null;
  setCurrentInstance: (instance: Instance | null) => void;
  refreshCurrentInstance: () => Promise<void>;
}

export const InstanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);

  // 自动从路由参数加载实例
  const params = useParams();
  useEffect(() => {
    if (params.instanceId) {
      loadInstance(params.instanceId);
    }
  }, [params.instanceId]);

  return (
    <InstanceContext.Provider value={{ currentInstance, setCurrentInstance, ... }}>
      {children}
    </InstanceContext.Provider>
  );
};
```

## 实现细节

### InstanceDetailPage 组件结构

```typescript
// pages/instances/InstanceDetailPage.tsx
export function InstanceDetailPage() {
  const { instanceId } = useParams();
  const { currentInstance, refreshCurrentInstance } = useInstance();
  const [activeTab, setActiveTab] = useState<'chat' | 'settings' | 'info'>('chat');

  // 加载实例数据
  useEffect(() => {
    loadInstance(instanceId);
  }, [instanceId]);

  if (!currentInstance) {
    return <Loading />;
  }

  return (
    <div className="instance-detail-page">
      {/* 顶部栏 */}
      <Header
        name={currentInstance.name}
        onBack={() => navigate('/instances')}
      />

      {/* Tab 内容区 */}
      {activeTab === 'chat' && (
        <InstanceChat instance={currentInstance} />
      )}
      {activeTab === 'settings' && (
        <InstanceSettings instance={currentInstance} />
      )}
      {activeTab === 'info' && (
        <InstanceInfo instance={currentInstance} />
      )}

      {/* 底部 Tab 切换 */}
      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
      />
    </div>
  );
}
```

### InstanceChat 组件

```typescript
// components/InstanceChat.tsx
export function InstanceChat({ instance }: { instance: Instance }) {
  const [messages, setMessages] = useState<Message[]>([]);

  // 使用 Iframe 加载实例的 Chat UI
  const chatUrl = `${instance.url}/chat`;

  return (
    <div className="instance-chat">
      {instance.source === 'custom' || instance.source === 'hardware' ? (
        // 自定义实例使用 Iframe
        <iframe src={chatUrl} className="w-full h-full border-0" />
      ) : (
        // 托管实例可以有自己的聊天界面或 API 集成
        <EmbeddedChat instance={instance} messages={messages} />
      )}
    </div>
  );
}
```

### InstanceSettings 组件

```typescript
// components/InstanceSettings.tsx
export function InstanceSettings({ instance }: { instance: Instance }) {
  const [name, setName] = useState(instance.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await tenantApi.updateInstance(instance.instanceId, { name });
      // 刷新实例数据
      await refreshCurrentInstance();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`确定要删除实例 "${instance.name}" 吗？`)) {
      await tenantApi.deleteInstance(instance.instanceId);
      navigate('/instances');
    }
  };

  return (
    <div className="instance-settings space-y-6">
      {/* 实例名称 */}
      <div>
        <label>实例名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={instance.name}
        />
      </div>

      {/* 健康状态 */}
      <div className="health-status">
        <h3>健康状态</h3>
        <div className={`status ${instance.isHealthy ? 'online' : 'offline'}`}>
          {instance.isHealthy ? '在线' : '离线'}
        </div>
      </div>

      {/* 实例信息 */}
      <div className="instance-info">
        <h3>实例信息</h3>
        <InfoRow label="类型" value={instance.source} />
        <InfoRow label="状态" value={instance.status} />
        <InfoRow label="创建时间" value={instance.createdAt} />
      </div>

      {/* 删除按钮 */}
      <button
        onClick={handleDelete}
        className="btn-danger w-full"
      >
        删除实例
      </button>
    </div>
  );
}
```

### InstanceInfo 组件

```typescript
// components/InstanceInfo.tsx
export function InstanceInfo({ instance }: { instance: Instance }) {
  return (
    <div className="instance-info space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>实例详情</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="实例 ID" value={instance.instanceId} />
          <InfoRow label="名称" value={instance.name} />
          <InfoRow label="类型" value={getInstanceTypeLabel(instance.source)} />
          <InfoRow label="状态" value={getInstanceStatus(instance)} />
          {instance.url && (
            <InfoRow label="访问地址" value={instance.url} />
          )}
          <InfoRow label="创建时间" value={formatDate(instance.createdAt)} />
          <InfoRow label="更新时间" value={formatDate(instance.updatedAt)} />
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Button onClick={() => window.open(instance.url, '_blank')}>
        在新窗口打开
      </Button>
    </div>
  );
}
```

## 更新的路由结构

```typescript
// 修改前（旧）
/instances          - 实例列表
/chat               - 全局 Chat（错误！）
/settings           - 全局 Settings（错误！）

// 修改后（新）
/instances          - 实例列表
/instances/new      - 创建实例
/instances/:id      - 实例详情 = Chat + Settings + Info
                    ├─ 默认显示 Chat
                    ├─ 可切换到 Settings（配置该实例）
                    └─ 可切换到 Info（查看实例信息）
```

## API 调整

### 更新实例名称

```typescript
// PUT /api/instances/:instanceId
{
  "name": "新名称"
}
```

### 获取实例健康状态

```typescript
// GET /api/instances/:instanceId/health
{
  "instanceId": "xxx",
  "isHealthy": true,
  "lastCheck": "2026-02-28T05:00:00Z"
}
```

## 迁移计划

### 阶段 1：创建新页面（不影响现有功能）

1. 创建 `InstanceDetailPage` 组件
2. 创建子组件：`InstanceChat`, `InstanceSettings`, `InstanceInfo`
3. 添加路由：`/instances/:instanceId`
4. 更新 `InstancesPage` 的 Link 跳转到新路由

### 阶段 2：废弃旧路由

1. 移除全局 `/chat` 和 `/settings` 路由
2. 更新导航逻辑
3. 更新文档

### 阶段 3：优化体验

1. 添加实例切换动画
2. 优化 Chat Iframe 加载
3. 添加离线提示
4. 优化移动端手势操作

## 优势

1. **清晰的关联关系**：每个实例有独立的 Chat 和 Settings
2. **符合用户心智模型**：实例 = Agent，Chat = 与该 Agent 对话
3. **移动端友好**：Tab 切换适合移动端操作
4. **与 PC 端一致**：概念上与 PC 端的 Chat Drawer 设计保持一致
5. **易于扩展**：未来可以添加更多 Tab（如 Logs、Metrics 等）

## 参考设计

- **PC 端**: `/multi-tenant/frontend/src/app/dashboard/page.tsx`
- **Chat Drawer**: `/multi-tenant/frontend/src/components/chat/ChatDrawer.tsx`
- **Chat Iframe**: `/multi-tenant/frontend/src/components/chat/ChatIframe.tsx`

## 总结

通过将实例、聊天和设置融合到一个统一的页面中，我们解决了：

1. ✅ 实例与 Chat/Settings 的关联不清晰
2. ✅ 用户不知道在跟哪个实例对话
3. ✅ 设置不知道针对哪个实例
4. ✅ 移动端导航复杂

新的设计更加直观、符合用户预期，并且与 PC 端的设计理念保持一致。
