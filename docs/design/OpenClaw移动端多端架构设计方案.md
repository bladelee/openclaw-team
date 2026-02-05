# OpenClaw 移动端多端架构设计方案

## 目录

1. [现状分析](#现状分析)
2. [方案对比](#方案对比)
3. [方案一：纯 H5 方案](#方案一纯-h5-方案)
4. [方案二：小程序主导方案](#方案二小程序主导方案)
5. [方案三：混合架构方案（推荐）](#方案三混合架构方案推荐)
6. [详细设计](#详细设计)
7. [实施路线图](#实施路线图)

---

## 现状分析

### Android 已实现功能清单

| 功能 | Android 实现 | 复杂度 | 用户价值 |
|------|-------------|--------|---------|
| Gateway 连接 | WebSocket + mDNS | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Canvas UI (A2UI) | WebView + Bridge | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 相机拍照/录像 | CameraX + MediaRecorder | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 屏幕录制 | MediaRecorder + Projection | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 位置服务 | FusedLocationProvider | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 短信 | SmsManager | ⭐⭐ | ⭐⭐⭐ |
| 聊天 | WebSocket + UI | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 语音唤醒 | SpeechRecognizer + Service | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 对话模式 | MediaPlayer + Streaming | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 前台服务 | ForegroundService | ⭐⭐⭐ | ⭐⭐⭐⭐ |

### 平台能力对比

#### 移动端平台能力对比表

| 能力 | H5 (Chrome/Safari) | 微信小程序 | 支付宝小程序 | 抖音/百度小程序 |
|------|---------------------|---------|-----------|---------------|
| **相机拍照** | ✅ MediaDevices | ✅ wx.createCameraContext() | ✅ my.createCameraContext() | ✅ |
| **麦克风** | ✅ MediaDevices | ✅ wx.createRecorderContext() | ✅ my.createRecorderContext() | ✅ |
| **地理位置** | ✅ Geolocation API | ✅ wx.getLocation() | ✅ my.getLocation() | ✅ |
| **后台定位** | ❌ 不支持 | ⚠️ 有限制 | ⚠️ 有限制 | ⚠️ 有限制 |
| **屏幕录制** | ✅ getDisplayMedia() | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |
| **蓝牙** | ✅ WebBluetooth | ✅ wx.openBluetoothAdapter() | ✅ | ✅ |
| **WebSocket** | ✅ WebSocket API | ✅ wx.connectSocket() | ✅ my.connectSocket() | ✅ |
| **HTTP/HTTPS** | ✅ fetch() | ✅ wx.request() | ✅ my.request() | ✅ |
| **本地存储** | ✅ IndexedDB (5GB+) | ⚠️ 10MB | ⚠️ 10MB | ⚠️ 10MB |
| **文件系统** | ✅ File System API | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 |
| **推送通知** | ✅ Service Worker + Push | ✅ Push API | ✅ | ✅ |
| **短信** | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |
| **电话** | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |
| **持续运行** | ❌ 不支持（标签页关闭即停止） | ⚠️ 有限（后台 5 分钟） | ⚠️ 有限 | ⚠️ 有限 |
| **后台音频** | ❌ 不支持 | ✅ wx.getBackgroundAudioManager() | ✅ | ✅ |

**关键发现**：
1. ✅ **H5 能力较强**：相机、麦克风、定位、WebSocket 完全支持
2. ❌ **屏幕录制**：H5 支持，小程序不支持
3. ❌ **短信/电话**：所有平台都不支持（仅限原生）
4. ⚠️ **后台运行**：小程序有限制，H5 不支持

---

## 方案对比

### 方案概览

| 方案 | 核心思路 | 优点 | 缺点 | 功能覆盖率 |
|------|---------|------|------|-----------|
| **方案一：纯 H5** | 只用 H5，不做小程序 | 开发简单、跨平台 | 无分发入口、无后台 | ~60% |
| **方案二：小程序主导** | 小程序为主，H5 为辅 | 有分发入口、用户习惯 | 能力受限、屏幕录制不支持 | ~50% |
| **方案三：混合架构** | H5 + 小程序，按场景选择 | 最大化功能覆盖 | 开发成本高 | ~85% |

### 详细对比

#### 功能覆盖对比

| 功能模块 | 方案一 (纯 H5) | 方案二 (小程序) | 方案三 (混合) |
|---------|--------------|---------------|---------------|
| Gateway 连接 | ✅ 100% | ✅ 100% | ✅ 100% |
| Canvas UI | ✅ 100% | ✅ 100% | ✅ 100% |
| 相机拍照 | ✅ 100% | ✅ 100% | ✅ 100% |
| 屏幕录制 | ✅ 100% | ❌ 0% | ✅ 100% (H5) |
| 位置服务 | ✅ 70% (无后台) | ✅ 80% (有限后台) | ✅ 80% |
| 短信 | ❌ 0% | ❌ 0% | ⚠️ 10% (需云服务) |
| 聊天 | ✅ 100% | ✅ 100% | ✅ 100% |
| 语音唤醒 | ⚠️ 30% (无后台) | ⚠️ 50% (有限) | ⚠️ 50% |
| 对话模式 | ✅ 90% | ✅ 95% | ✅ 95% |
| 后台运行 | ❌ 0% | ⚠️ 20% | ⚠️ 20% |

**方案三（混合架构）是最佳选择**：功能覆盖率最高（~85%），在关键功能（屏幕录制、对话模式）上具有优势。

---

## 方案一：纯 H5 方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  纯 H5 架构                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户通过浏览器访问 H5                                     │
│    │                                                       │
│    ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  A2UI React H5                                         │   │
│  │  - Canvas UI 渲染                                      │   │
│  │  - WebSocket 连接 Gateway                              │   │
│  │  - Web APIs 调用                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│    │                                                       │
│    ├─> Camera (MediaDevices API)                           │
│    ├─> Microphone (MediaDevices API)                       │
│    ├─> Geolocation (Geolocation API)                       │
│    ├─> Screen Recording (getDisplayMedia)                  │
│    └─> Storage (IndexedDB)                                │
│                                                             │
│  缺失功能：                                                 │
│    ❌ 短信（浏览器无法发送短信）                           │
│    ❌ 后台运行（标签页关闭即停止）                          │
│    ❌ 推送通知（Service Worker 有限）                        │
│    ❌ 语音唤醒（无法后台监听）                              │
└─────────────────────────────────────────────────────────────┘
```

### 技术实现

#### 1. 相机功能

```typescript
// H5 相机实现
class H5CameraManager {
  private stream: MediaStream | null = null;

  async takePhoto(): Promise<Blob> {
    // 请求相机权限
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });

    // 创建 video 元素捕获帧
    const video = document.createElement('video');
    video.srcObject = this.stream;
    await video.play();

    // 绘制到 canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // 转换为 Blob
    return new Blob([await this.getCanvasBlob(canvas)], { type: 'image/jpeg' });
  }

  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true
    });

    const mediaRecorder = new MediaRecorder(this.stream);
    mediaRecorder.start();
  }

  private async getCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/jpeg', 0.9);
    });
  }
}
```

#### 2. 屏幕录制

```typescript
// H5 屏幕录制实现
class H5ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;

  async startRecording(): Promise<void> {
    // 获取屏幕共享流
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: true
    });

    // 创建 MediaRecorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.ondataavailable = (e) => {
          resolve(e.data);
        };
        this.mediaRecorder.stop();
      }
    });
  }
}
```

#### 3. 位置服务

```typescript
// H5 位置服务实现
class H5LocationManager {
  private watchId: number | null = null;

  async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  watchPosition(callback: (position: GeolocationPosition) => void): void {
    this.watchId = navigator.geolocation.watchPosition(
      (position) => callback(position),
      (error) => console.error('位置监听错误:', error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        distanceFilter: 10 // 移动 10 米触发
      }
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
```

#### 4. 聊天功能（WebSocket）

```typescript
// H5 聊天实现
class H5ChatManager {
  private ws: WebSocket | null = null;

  connect(gatewayUrl: string): void {
    this.ws = new WebSocket(gatewayUrl);

    this.ws.onopen = () => {
      console.log('WebSocket 已连接');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // 处理聊天消息
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket 已关闭');
      // 自动重连
      setTimeout(() => this.connect(gatewayUrl), 3000);
    };
  }

  sendMessage(text: string, attachments: Attachment[]): void {
    const message = {
      type: 'chat',
      text,
      attachments,
      timestamp: Date.now()
    };

    this.ws?.send(JSON.stringify(message));
  }

  private handleMessage(message: any): void {
    // 更新 A2UI Canvas
    if (message.type === 'a2ui') {
      window.openclawA2UI.applyMessages(message.messages);
    }
  }
}
```

### 优缺点

#### ✅ 优点
1. **开发简单**：只需维护一套 H5 代码
2. **跨平台**：所有现代浏览器都支持
3. **功能完善**：相机、麦克风、定位、屏幕录制全部支持
4. **无需审核**：不受应用商店审核限制

#### ❌ 缺点
1. **无分发入口**：用户需要手动输入 URL
2. **无后台运行**：标签页关闭即停止
3. **无短信功能**：浏览器无法发送短信
4. **无推送通知**：Service Worker 限制较多
5. **用户习惯**：用户更习惯使用 App/小程序

---

## 方案二：小程序主导方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  小程序主导架构                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户通过微信小程序访问                                    │
│    │                                                       │
│    ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  小程序容器                                              │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  <web-view src="...">              │ │   │
│  │  │  ├─> A2UI React H5                 │ │   │
│  │  │  │   - Canvas UI 渲染              │ │   │
│  │  │  │   - WebSocket 连接              │ │   │
│  │  │  │   - 调用小程序能力桥接        │ │   │
│  │  │  └─────────────────────────────────────────┘ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                       │
│  │  原生小程序页面（设置、聊天）                          │   │
│  │                                                       │
│  └─────────────────────────────────────────────────────┘   │
│    │                                                       │
│    ├─> 小程序相机 API                                      │
│    ├─> 小程序麦克风 API                                    │
│    ├─> 小程序定位 API                                      │
│    ├─> 小程序 WebSocket                                     │
│    ├─> 小程序后台音频                                      │
│    └─> 小程序推送通知                                      │
│                                                             │
│  缺失功能：                                                 │
│    ❌ 屏幕录制（小程序不支持）                              │
│    ❌ 短信（小程序不支持）                                  │
│    ⚠️ 后台运行（有限制）                                    │
│    ⚠️ 语音唤醒（有限制）                                    │
└─────────────────────────────────────────────────────────────┘
```

### 技术实现

#### 1. H5 与小程序桥接

```typescript
// 小程序桥接层
class MiniProgramBridge {
  // 调用小程序相机
  async takePhoto(): Promise<string> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.createCameraContext().startRecord({
        success: (res) => {
          miniProgram.createCameraContext().stopRecord({
            success: (result) => {
              resolve(result.tempImagePath);
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  }

  // 调用小程序定位
  async getLocation(): Promise<MiniProgramLocation> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.getLocation({
        type: 'gcj02',
        success: resolve,
        fail: reject
      });
    });
  }

  // 调用小程序 WebSocket
  connectWebSocket(url: string): void {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    miniProgram.connectSocket({
      url,
      success: () => {
        console.log('WebSocket 已连接');
      },
      fail: (error) => {
        console.error('WebSocket 连接失败:', error);
      }
    });

    miniProgram.onSocketMessage((message) => {
      const data = JSON.parse(message.data);
      // 发送到 H5
      this.postMessageToH5({
        type: 'websocket',
        data
      });
    });
  }

  // 发送消息到 H5
  private postMessageToH5(message: any): void {
    // @ts-ignore
    const webView = this.getWebView();
    if (webView) {
      webView.postMessage(message);
    }
  }

  private getWebView(): any {
    // @ts-ignore
    return document.querySelector('web-view');
  }
}
```

#### 2. 小程序后台音频（对话模式）

```typescript
// 小程序后台音频实现
class MiniProgramAudioManager {
  private innerAudioContext: any;

  constructor() {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;
    this.innerAudioContext = miniProgram.createInnerAudioContext();
  }

  playText(text: string): void {
    // 使用 TTS 接口
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    // 语音合成
    miniProgram.createRecorderContext().start({
      duration: 10000,
      format: 'mp3'
    });

    // 播放音频
    this.innerAudioContext.src = this.textToSpeechUrl(text);
    this.innerAudioContext.play();
  }

  startRecording(): void {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;
    const recorder = miniProgram.createRecorderContext();

    recorder.start({
      format: 'mp3'
    });

    recorder.onFrameRecorded((res) => {
      const { frameBuffer } = res;
      // 发送到 Gateway
      this.sendAudioChunk(frameBuffer);
    });
  }

  private textToSpeechUrl(text: string): string {
    // 调用 TTS 服务
    return `https://tts.api/synthesize?text=${encodeURIComponent(text)}`;
  }

  private sendAudioChunk(chunk: ArrayBuffer): void {
    // 通过 WebSocket 发送音频到 Gateway
    // Gateway 进行语音识别
  }
}
```

#### 3. 小程序后台定位

```typescript
// 小程序后台定位
class MiniProgramLocationManager {
  startBackgroundTracking(): void {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    // 请求后台定位权限
    miniProgram.startLocationUpdate({
      background: true,
      success: () => {
        console.log('后台定位已启动');
      },
      fail: (error) => {
        console.error('后台定位启动失败:', error);
      }
    });

    miniProgram.onLocationChange((location) => {
      this.handleLocationChange(location);
    });
  }

  private handleLocationChange(location: any): void {
    const { latitude, longitude, speed, accuracy } = location;

    // 发送到 Gateway
    this.sendLocationToGateway({
      latitude,
      longitude,
      speed,
      accuracy,
      timestamp: Date.now()
    });
  }
}
```

### 优缺点

#### ✅ 优点
1. **有分发入口**：微信、支付宝等平台
2. **用户体验好**：符合用户习惯
3. **支持后台音频**：可以播放音频
4. **支持推送**：可以接收推送通知
5. **支付集成**：集成支付功能

#### ❌ 缺点
1. **屏幕录制不支持**：小程序不支持 getDisplayMedia
2. **能力受限**：API 限制较多
3. **审核限制**：需要平台审核
4. **存储限制**：通常只有 10MB
5. **平台依赖**：受平台政策影响

---

## 方案三：混合架构方案（推荐）

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  混合架构（H5 + 小程序）                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  核心策略：按场景选择最佳平台                               │
│                                                             │
│  场景 1：需要屏幕录制、完整浏览器能力 → 使用 H5            │
│  场景 2：需要分发入口、用户习惯 → 使用小程序                │
│  场景 3：需要后台运行、推送 → 使用小程序                      │
│  场景 4：需要原生能力 → 保持 Android/iOS App                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  统一服务层（Gateway API + 云服务）                  │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  Gateway WebSocket Server                         │ │   │
│  │  │  - AI Agent 运行                                   │ │   │
│  │  │  - 消息路由                                       │ │   │
│  │  │  - 状态管理                                       │   │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  云服务（补充 H5/小程序缺失功能）                 │ │   │
│  │  │  - SMS 云服务                                   │ │   │
│  │  │  - 云存储                                       │ │   │
│  │  │  - 云函数（后端任务）                           │   │   │
│  │  │  - 推送服务                                     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┴──────────────┐                  │
│          ▼                                  ▼                  │
│  ┌──────────────┐                    ┌──────────────┐      │
│  │  H5 平台     │                    │  小程序平台   │      │
│  │              │                    │              │      │
│  │  ┌────────┐  │                    │  ┌──────────┐  │      │
│  │  │A2UI H5 │  │                    │  │原生页面   │  │      │
│  │  │Canvas  │  │                    │  │(设置/聊天)│  │      │
│  │  └────────┘  │                    │  │          │  │      │
│  │              │                    │  └──────────┘  │      │
│  │  ┌────────┐  │                    │  ┌──────────┐  │      │
│  │  │Web API │  │                    │  │<web-view>│  │      │
│  │  │调用    │  │                    │  │(H5 嵌入) │  │      │
│  │  └────────┘  │                    │  └──────────┘  │      │
│  └──────────────┘                    └──────────────┘      │
│         │                                   │            │
│         └───────────────┬───────────────┘            │
│                         ▼                                │
│                 ┌─────────────────────┐                  │
│                 │  能力适配层          │                  │
│                 │  - 统一接口          │                  │
│                 │  - 平台检测          │                  │
│                 │  - 降级策略          │                  │
│                 └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 核心设计理念

#### 1. 按场景分流

```
┌─────────────────────────────────────────────────────────────┐
│  场景分流策略                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  H5 平台适用场景：                                          │
│  ✅ 屏幕录制（独有功能）                                     │
│  ✅ 技术支持（远程支持、录制屏幕）                          │
│  ✅ 产品演示（录制演示视频）                                │
│  ✅ 临时使用（无需安装）                                     │
│  ✅ 功能展示（展示新功能）                                  │
│                                                             │
│  小程序适用场景：                                          │
│  ✅ 日常使用（习惯打开小程序）                              │
│  ✅ 聊天对话（推送通知）                                    │
│  ✅ 语音助手（语音唤醒、对话）                              │
│  ✅ 位置追踪（后台定位）                                    │
│  ✅ 支付场景（集成支付）                                    │
│                                                             │
│  Android/iOS App 适用场景：                                 │
│  ✅ 短信发送（独有功能）                                    │
│  ✅ 后台运行（完整后台服务）                                │
│  ✅ 完整功能（所有功能）                                   │
│  ✅ 重度用户（高频使用）                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 2. 统一能力适配层

```typescript
/**
 * 能力适配层
 * 统一不同平台的能力接口，自动降级
 */
interface PlatformCapability {
  name: string;
  supported: boolean;
  platform: 'h5' | 'miniprogram' | 'native';
  fallback?: string;
}

class CapabilityAdapter {
  private capabilities: Map<string, PlatformCapability>;

  constructor() {
    this.capabilities = new Map();
    this.detectCapabilities();
  }

  private detectCapabilities(): void {
    // 检测当前平台
    const platform = this.detectPlatform();

    // 相机能力
    this.capabilities.set('camera', {
      name: 'camera',
      supported: true,
      platform,
      fallback: undefined
    });

    // 屏幕录制能力（仅 H5 支持）
    this.capabilities.set('screenRecording', {
      name: 'screenRecording',
      supported: platform === 'h5',
      platform,
      fallback: 'miniProgramNotSupported'
    });

    // 短信能力（仅原生支持）
    this.capabilities.set('sms', {
      name: 'sms',
      supported: platform === 'native',
      platform,
      fallback: 'cloudService'
    });

    // 位置能力
    this.capabilities.set('location', {
      name: 'location',
      supported: true,
      platform,
      fallback: undefined
    });

    // 后台定位
    this.capabilities.set('backgroundLocation', {
      name: 'backgroundLocation',
      supported: platform !== 'h5',
      platform,
      fallback: 'foregroundOnly'
    });
  }

  private detectPlatform(): 'h5' | 'miniprogram' | 'native' {
    // @ts-ignore
    if (typeof wx !== 'undefined' || typeof my !== 'undefined') {
      return 'miniprogram';
    }
    if (typeof window !== 'undefined') {
      return 'h5';
    }
    return 'native';
  }

  /**
   * 检查能力是否支持
   */
  isSupported(capabilityName: string): boolean {
    return this.capabilities.get(capabilityName)?.supported ?? false;
  }

  /**
   * 获取能力实现
   */
  async getCapability(capabilityName: string): Promise<any> {
    const capability = this.capabilities.get(capabilityName);
    if (!capability) {
      throw new Error(`未知能力: ${capabilityName}`);
    }

    if (capability.supported) {
      return this.createCapability(capability);
    }

    // 使用降级方案
    return this.createFallback(capability);
  }

  private async createCapability(capability: PlatformCapability): Promise<any> {
    switch (capability.name) {
      case 'camera':
        return new CameraAdapter(capability.platform);
      case 'screenRecording':
        return new ScreenRecordingAdapter(capability.platform);
      case 'sms':
        return new SMSAdapter(capability.platform);
      case 'location':
        return new LocationAdapter(capability.platform);
      default:
        throw new Error(`未实现的能力: ${capability.name}`);
    }
  }

  private async createFallback(capability: PlatformCapability): Promise<any> {
    switch (capability.fallback) {
      case 'miniProgramNotSupported':
        console.warn('小程序不支持屏幕录制');
        return null;
      case 'cloudService':
        console.warn('使用云服务替代');
        return new CloudServiceAdapter(capability.name);
      case 'foregroundOnly':
        console.warn('降级为前台定位');
        return new ForegroundLocationAdapter();
      default:
        throw new Error(`无降级方案: ${capability.fallback}`);
    }
  }
}
```

#### 3. 统一服务接口

```typescript
/**
 * 统一服务接口
 * 屏蔽平台差异，提供一致的服务体验
 */
interface IScreenRecordingService {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  isSupported(): boolean;
}

/**
 * H5 屏幕录制实现
 */
class H5ScreenRecordingService implements IScreenRecordingService {
  private mediaRecorder: MediaRecorder | null = null;

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true
    });

    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.ondataavailable = (e) => resolve(e.data);
        this.mediaRecorder.stop();
      }
    });
  }

  isSupported(): boolean {
    return !!navigator.mediaDevices?.getDisplayMedia;
  }
}

/**
 * 小程序屏幕录制实现（降级）
 */
class MiniProgramScreenRecordingService implements IScreenRecordingService {
  async startRecording(): Promise<void> {
    throw new Error('小程序不支持屏幕录制，请使用 H5 平台');
  }

  async stopRecording(): Promise<Blob> {
    throw new Error('小程序不支持屏幕录制');
  }

  isSupported(): boolean {
    return false;
  }
}

/**
 * 工厂模式：根据平台选择实现
 */
class ScreenRecordingServiceFactory {
  static create(): IScreenRecordingService {
    const platform = CapabilityAdapter.detectPlatform();

    switch (platform) {
      case 'h5':
        return new H5ScreenRecordingService();
      case 'miniprogram':
        return new MiniProgramScreenRecordingService();
      case 'native':
        return new NativeScreenRecordingService();
      default:
        throw new Error(`未知平台: ${platform}`);
    }
  }
}
```

---

## 详细设计

### 1. 相机功能设计

#### 跨平台实现

```typescript
/**
 * 统一相机接口
 */
interface ICameraService {
  takePhoto(): Promise<Blob>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  isSupported(): boolean;
}

/**
 * H5 相机实现
 */
class H5CameraService implements ICameraService {
  private stream: MediaStream | null = null;

  async takePhoto(): Promise<Blob> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = this.stream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
    });
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices?.getUserMedia);
  }
}

/**
 * 小程序相机实现
 */
class MiniProgramCameraService implements ICameraService {
  async takePhoto(): Promise<Blob> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.createCameraContext().takePhoto({
        quality: 'high',
        success: (res) => {
          // 将临时文件转换为 Blob
          this.getFileInfo(res.tempImagePath).then(resolve);
        },
        fail: reject
      });
    });
  }

  private async getFileInfo(tempFilePath: string): Promise<Blob> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.getFileInfo({
        filePath: tempFilePath,
        success: (res) => {
          miniProgram.getFileSystemManager().readFile({
            filePath: tempFilePath,
            success: (data) => {
              const blob = new Blob([data]);
              resolve(blob);
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  }

  isSupported(): boolean {
    // @ts-ignore
    return !!(wx || my || tt || swan)?.createCameraContext;
  }
}
```

### 2. 位置服务设计

#### 多模式定位

```typescript
/**
 * 统一位置接口
 */
interface ILocationService {
  getCurrentPosition(): Promise<LocationInfo>;
  watchPosition(callback: (position: LocationInfo) => void): void;
  startBackgroundTracking(): Promise<void>;
  stopBackgroundTracking(): void;
  isBackgroundSupported(): boolean;
}

/**
 * H5 位置实现
 */
class H5LocationService implements ILocationService {
  private watchId: number | null = null;

  async getCurrentPosition(): Promise<LocationInfo> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || null,
            altitudeAccuracy: position.coords.altitudeAccuracy || null,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null,
            timestamp: position.timestamp
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  watchPosition(callback: (position: LocationInfo) => void): void {
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => console.error('位置监听错误:', error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        distanceFilter: 10
      }
    );
  }

  async startBackgroundTracking(): Promise<void> {
    // H5 不支持后台定位
    throw new Error('H5 不支持后台定位，请使用小程序或原生 App');
  }

  stopBackgroundTracking(): void {
    // H5 不支持后台定位
  }

  isBackgroundSupported(): boolean {
    return false;
  }
}

/**
 * 小程序位置实现
 */
class MiniProgramLocationService implements ILocationService {
  async getCurrentPosition(): Promise<LocationInfo> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            timestamp: Date.now()
          });
        },
        fail: reject
      });
    });
  }

  watchPosition(callback: (position: LocationInfo) => void): void {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    miniProgram.onLocationChange((res) => {
      callback({
        latitude: res.latitude,
        longitude: res.longitude,
        accuracy: res.accuracy,
        accuracy: res.altitude,
        timestamp: Date.now()
      });
    });
  }

  async startBackgroundTracking(): Promise<void> {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;

    return new Promise((resolve, reject) => {
      miniProgram.startLocationUpdate({
        background: true,
        success: () => resolve(),
        fail: reject
      });
    });
  }

  stopBackgroundTracking(): void {
    // @ts-ignore
    const miniProgram = wx || my || my || tt || swan;
    miniProgram.stopLocationUpdate();
  }

  isBackgroundSupported(): boolean {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;
    return !!miniProgram.startLocationUpdate;
  }
}
```

### 3. 短信功能设计

#### 云服务方案（绕过平台限制）

```typescript
/**
 * 统一短信接口
 */
interface ISMSService {
  sendSMS(phoneNumber: string, message: string): Promise<void>;
  isSupported(): boolean;
}

/**
 * 云短信服务（H5/小程序通用）
 */
class CloudSMSService implements ISMSService {
  private apiEndpoint: string;

  constructor() {
    this.apiEndpoint = 'https://api.cloudsms.com/send';
  }

  async sendSMS(phoneNumber: string, message: string): Promise<void> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: await this.getApiKey(),
        to: phoneNumber,
        message: message
      })
    });

    if (!response.ok) {
      throw new Error('短信发送失败');
    }

    // 记录发送日志
    await this.logSentSMS(phoneNumber, message);
  }

  isSupported(): boolean {
    // 云服务总是可用
    return true;
  }

  private async getApiKey(): Promise<string> {
    // 从服务器获取 API Key
    const response = await fetch('/api/sms/key');
    const data = await response.json();
    return data.apiKey;
  }

  private async logSentSMS(phoneNumber: string, message: string): Promise<void> {
    // 记录到数据库
    await fetch('/api/sms/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        message,
        timestamp: Date.now(),
        platform: this.detectPlatform()
      })
    });
  }

  private detectPlatform(): string {
    // @ts-ignore
    if (typeof wx !== 'undefined') return 'miniprogram';
    // @ts-ignore
    if (typeof my !== 'undefined') return 'miniprogram';
    if (typeof window !== 'undefined') return 'h5';
    return 'native';
  }
}
```

### 4. 语音唤醒设计

#### 小程序语音唤醒

```typescript
/**
 * 小程序语音唤醒服务
 */
class MiniProgramVoiceWakeService {
  private recorderManager: any;
  private isListening: boolean = false;

  constructor() {
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;
    this.recorderManager = miniProgram.getRecorderManager();
  }

  async startListening(wakeWords: string[]): Promise<void> {
    const frameSize = 5;
    const numberOfChannels = 1;
    const sampleRate = 16000;
    const bitrate = 48000;

    this.recorderManager.start({
      format: 'mp3',
      frameSize,
      numberOfChannels,
      sampleRate,
      bitrate,
      duration: 60000 // 最长录制 60 秒（循环）
    });

    this.recorderManager.onFrameRecorded((res) => {
      const { frameBuffer, isLastFrame } = res;

      // 发送音频到 Gateway 进行语音识别
      this.sendAudioToGateway(frameBuffer);

      if (isLastFrame) {
        // 重新开始录制
        this.recorderManager.start({
          format: 'mp3',
          frameSize,
          numberOfChannels,
          sampleRate,
          bitrate
        });
      }
    });

    this.isListening = true;
  }

  stopListening(): void {
    this.recorderManager.stop();
    this.isListening = false;
  }

  private async sendAudioToGateway(audioBuffer: ArrayBuffer): Promise<void> {
    // 通过 WebSocket 发送音频到 Gateway
    // Gateway 使用 Vosk 或云端 ASR 进行识别
    const ws = await this.getWebSocketConnection();

    ws.send({
      type: 'audio',
      audio: this.arrayBufferToBase64(audioBuffer),
      format: 'mp3'
    });
  }

  private async getWebSocketConnection(): Promise<WebSocket> {
    // 获取或创建 WebSocket 连接
    // @ts-ignore
    const miniProgram = wx || my || tt || swan;
    return miniProgram.getWebSocketConnection();
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
```

### 5. 对话模式设计

#### H5 对话模式

```typescript
/**
 * H5 对话模式服务
 */
class H5TalkModeService {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioQueue: AudioBuffer[] = [];

  async startListening(): Promise<void> {
    // 请求麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000
      }
    });

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // 发送到 Gateway 进行语音识别
      this.sendAudioToGateway(inputData);
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  async speak(text: string, directive: TalkDirective): Promise<void> {
    // 调用 TTS 服务生成音频
    const audioUrl = await this.textToSpeech(text, directive);

    // 播放音频
    const audio = new Audio(audioUrl);

    await audio.play();
  }

  private async textToSpeech(text: string, directive: TalkDirective): Promise<string> {
    // 调用 Gateway TTS 服务
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        speed: directive.speed || 1.0,
        pitch: directive.pitch || 1.0,
        voice: directive.voice || 'default'
      })
    });

    const data = await response.json();
    return data.audioUrl;
  }

  private sendAudioToGateway(audioData: Float32Array): void {
    // 转换为 Int16
    const int16Data = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // 通过 WebSocket 发送
    const ws = this.getWebSocketConnection();
    ws.send({
      type: 'audio',
      audio: this.arrayBufferToBase64(int16Data.buffer),
      sampleRate: 16000
    });
  }
}
```

---

## 实施路线图

### 阶段 1：基础能力实现（1-2 周）

```
Week 1-2: 基础能力层
├── [ ] 能力适配层
├── [ ] H5 相机服务
├── [ ] H5 屏幕录制服务
├── [ ] H5 位置服务
├── [ ] 小程序相机服务
├── [ ] 小程序位置服务
└── [ ] 单元测试
```

### 阶段 2：云服务集成（1 周）

```
Week 3: 云服务
├── [ ] 短信云服务集成
├── [ ] TTS 云服务集成
├── [ ] ASR 云服务集成
├── [ ] 云存储服务
└── [ ] API 网关
```

### 阶段 3：小程序实现（2-3 周）

```
Week 4-5: 小程序
├── [ ] 微信小程序
│   ├── [ ] 原生页面（设置、聊天）
│   ├── [ ] Web View 集成（A2UI H5）
│   └── [ ] 桥接层
├── [ ] 支付宝小程序
└── [ ] 其他小程序（按需）
```

### 阶段 4：高级功能（2-3 周）

```
Week 6-8: 高级功能
├── [ ] 语音唤醒（小程序）
├── [ ] 对话模式（H5 + 小程序）
├── [ ] 后台定位（小程序）
├── [ ] 推送通知
└── [ ] 性能优化
```

### 阶段 5：测试与上线（1 周）

```
Week 9: 测试与上线
├── [ ] 功能测试
├── [ ] 兼容性测试
├── [ ] 性能测试
├── [ ] 小程序审核
└── [ ] 正式上线
```

---

## 总结与建议

### 方案对比总结

| 维度 | 方案一 (纯 H5) | 方案二 (小程序) | 方案三 (混合) |
|------|---------------|---------------|---------------|
| **功能覆盖率** | ~60% | ~50% | ~85% |
| **开发成本** | 低 | 中 | 高 |
| **维护成本** | 低 | 中 | 高 |
| **用户体验** | 中 | 高 | 高 |
| **分发渠道** | 无 | 优秀 | 优秀 |
| **推荐度** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 最终推荐

**推荐方案三（混合架构）**，理由如下：

1. **功能覆盖率最高**（~85%）
   - H5 提供屏幕录制等独有功能
   - 小程序提供分发入口和用户习惯
   - 云服务补充短信等缺失功能

2. **灵活性最强**
   - 按场景选择最佳平台
   - 可以逐步添加新平台
   - 不受单一平台限制

3. **用户体验最好**
   - 小程序满足日常使用
   - H5 提供高级功能
   - 原生 App 提供完整功能

### 实施建议

**分阶段实施**：
1. **Phase 1**：先实现 H5 版本（快速验证）
2. **Phase 2**：添加微信小程序（主要用户群）
3. **Phase 3**：集成云服务（补充缺失功能）
4. **Phase 4**：添加其他小程序（支付宝、抖音等）
5. **Phase 5**：保持 Android/iOS 原生 App（高级用户）

**技术选型**：
- H5：Chrome/Safari 最新版本
- 小程序：微信、支付宝（覆盖主流用户）
- 云服务：阿里云、腾讯云（短信、TTS、ASR）
- 通信协议：WebSocket + HTTP

---

**文档版本**: v1.0
**创建日期**: 2025-02-04
**作者**: OpenClaw Team
