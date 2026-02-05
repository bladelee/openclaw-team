# A2UI React H5 手工测试用例

## 测试环境准备

### 前置条件
1. 确保 gateway 已启动
2. 确认 A2UI React 已构建：`pnpm a2ui:react:build`
3. 准备测试设备：
   - iOS 真机 (iOS 13+)
   - Android 真机 (Android 8+)
   - 桌面浏览器

### 访问地址
```
http://gateway-host:18789/__openclaw__/a2ui/react
```

---

## 测试用例

### TC-001: 基础页面加载

**优先级**: P0 (必须通过)

**测试步骤**:
1. 在浏览器中访问 A2UI React URL
2. 等待页面完全加载

**预期结果**:
- ✅ 页面标题显示 "OpenClaw A2UI"
- ✅ 页面空白但有 `#root` div 元素
- ✅ 控制台无错误信息

**实际结果**: _____ 日期: _____

---

### TC-002: 消息处理 - 渲染简单文本

**优先级**: P0

**测试步骤**:
1. 打开浏览器开发者工具 (F12)
2. 在 Console 中执行：
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'root',
          component: {
            Container: {}
          }
        },
        {
          id: 'hello-text',
          component: {
            Text: {
              text: { literalString: 'Hello A2UI!' }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'root'
    }
  }
]);
```

**预期结果**:
- ✅ 页面显示 "Hello A2UI!" 文本
- ✅ 文本样式正确（默认字体大小和颜色）
- ✅ 控制台输出 "[A2UI React] Internal API exposed"

**实际结果**: _____ 日期: _____

---

### TC-003: 按钮组件测试

**优先级**: P0

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'root',
          component: {
            Container: {
              padding: { literalNumber: 20 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '按钮测试' },
              size: 'xlarge',
              weight: 'bold'
            }
          }
        },
        {
          id: 'btn1',
          component: {
            Button: {
              text: { literalString: '点击我' },
              action: {
                name: 'test_click',
                surfaceId: 'main',
                context: []
              }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'root'
    }
  }
]);
```

**预期结果**:
- ✅ 显示 "按钮测试" 标题
- ✅ 显示一个可点击的按钮
- ✅ 按钮文本为 "点击我"
- ✅ 点击按钮有视觉反馈（按下效果）

**实际结果**: _____ 日期: _____

---

### TC-004: 表单输入测试

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'form',
          component: {
            Column: {
              children: { explicitList: ['name-field', 'email-field', 'submit-btn'] },
              spacing: { literalNumber: 12 }
            }
          }
        },
        {
          id: 'name-field',
          component: {
            TextField: {
              label: { literalString: '姓名' },
              placeholder: { literalString: '请输入姓名' }
            }
          }
        },
        {
          id: 'email-field',
          component: {
            TextField: {
              label: { literalString: '邮箱' },
              placeholder: { literalString: '请输入邮箱' }
            }
          }
        },
        {
          id: 'submit-btn',
          component: {
            Button: {
              text: { literalString: '提交' },
              action: {
                name: 'form_submit',
                surfaceId: 'main'
              }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'form'
    }
  }
]);
```

**预期结果**:
- ✅ 显示 "姓名" 输入框，带 placeholder
- ✅ 显示 "邮箱" 输入框，带 placeholder
- ✅ 显示 "提交" 按钮
- ✅ 可以在输入框中输入文本
- ✅ 输入框有焦点状态样式

**实际结果**: _____ 日期: _____

---

### TC-005: 卡片组件测试

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'card',
          component: {
            Card: {
              padding: { literalNumber: 20 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '卡片标题' },
              weight: 'bold',
              size: 'large'
            }
          }
        },
        {
          id: 'content',
          component: {
            Text: {
              text: { literalString: '这是卡片内容' },
              color: '#666666'
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'card'
    }
  }
]);
```

**预期结果**:
- ✅ 显示带圆角的卡片容器
- ✅ 卡片有内边距 (20px)
- ✅ 显示标题和内容
- ✅ 卡片有背景色

**实际结果**: _____ 日期: _____

---

### TC-006: 图片组件测试

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'image-container',
          component: {
            Container: {
              padding: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'test-image',
          component: {
            Image: {
              url: { literalString: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect width="200" height="100" fill="%2306b6d4"/%3E%3C/svg%3E' },
              alt: { literalString: '测试图片' },
              fit: 'cover'
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'image-container'
    }
  }
]);
```

**预期结果**:
- ✅ 显示图片（蓝色方块）
- ✅ 图片有合适的宽高
- ✅ 图片适应模式为 cover

**实际结果**: _____ 日期: _____

---

### TC-007: 布局组件测试 (Column/Row)

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'layout',
          component: {
            Row: {
              children: { explicitList: ['left', 'center', 'right'] },
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'left',
          component: {
            Text: { text: { literalString: '左侧' } }
          }
        },
        {
          id: 'center',
          component: {
            Text: { text: { literalString: '中间' } }
          }
        },
        {
          id: 'right',
          component: {
            Text: { text: { literalString: '右侧' } }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'layout'
    }
  }
]);
```

**预期结果**:
- ✅ 三个文本横向排列
- ✅ 元素之间有间距 (16px)
- ✅ 可以水平滚动查看所有元素

**实际结果**: _____ 日期: _____

---

### TC-008: 主题切换测试

**优先级**: P2

**测试步骤**:
1. 执行 TC-002 加载页面
2. 在 Console 中检查主题：
```javascript
// 检查当前主题
console.log('Theme mode:', window.document.documentElement.getAttribute('data-theme'));

// 切换到浅色模式
window.openclawA2UI?.setMode?.('light');

// 切换到深色模式
window.openclawA2UI?.setMode?.('dark');

// 切换到自动模式
window.openclawA2UI?.setMode?.('auto');
```

**预期结果**:
- ✅ 初始主题为深色 (dark)
- ✅ 可以切换到浅色模式
- ✅ 可以切换回深色模式
- ✅ 支持自动模式（跟随系统）

**实际结果**: _____ 日期: _____

---

### TC-009: 数据模型绑定测试

**优先级**: P1

**测试步骤**:
```javascript
// 1. 设置数据模型
await window.openclawA2UI.applyMessages([
  {
    dataModelUpdate: {
      surfaceId: 'main',
      path: '/user',
      contents: [
        { key: 'name', valueString: '张三' },
        { key: 'age', valueNumber: 25 },
        { key: 'city', valueString: '北京' }
      ]
    }
  }
]);

// 2. 创建使用数据的 UI
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'info',
          component: {
            Column: {
              children: { explicitList: ['name', 'age', 'city'] },
              spacing: { literalNumber: 8 }
            }
          }
        },
        {
          id: 'name',
          component: {
            Text: {
              text: { path: '/user/name' }
            }
          }
        },
        {
          id: 'age',
          component: {
            Text: {
              text: { path: '/user/age' }
            }
          }
        },
        {
          id: 'city',
          component: {
            Text: {
              text: { path: '/user/city' }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'info'
    }
  }
]);
```

**预期结果**:
- ✅ 数据模型设置成功
- ✅ UI 显示数据值（可能显示路径或值）
- ✅ getSurfaces() 返回 ['main']

**实际结果**: _____ 日期: _____

---

### TC-010: 多 Surface 管理

**优先级**: P2

**测试步骤**:
```javascript
// 创建第一个 Surface
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'surface1',
      components: [
        {
          id: 'text1',
          component: {
            Text: { text: { literalString: 'Surface 1' } }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'surface1',
      root: 'text1'
    }
  }
]);

// 创建第二个 Surface
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'surface2',
      components: [
        {
          id: 'text2',
          component: {
            Text: { text: { literalString: 'Surface 2' } }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'surface2',
      root: 'text2'
    }
  }
]);

// 获取 Surface 列表
const surfaces = window.openclawA2UI.getSurfaces();
console.log('Active surfaces:', surfaces);
```

**预期结果**:
- ✅ 可以创建多个 Surface
- ✅ getSurfaces() 返回 ['surface1', 'surface2']
- ✅ 每个 Surface 独立管理

**实际结果**: _____ 日期: _____

---

### TC-011: Reset 功能测试

**优先级**: P1

**测试步骤**:
1. 先执行 TC-002 创建一些内容
2. 在 Console 中执行：
```javascript
const result = await window.openclawA2UI.reset();
console.log('Reset result:', result);

const surfaces = window.openclawA2UI.getSurfaces();
console.log('Surfaces after reset:', surfaces);
```

**预期结果**:
- ✅ reset() 返回 { ok: true }
- ✅ 页面内容被清空
- ✅ getSurfaces() 返回空数组 []

**实际结果**: _____ 日期: _____

---

### TC-012: 桥接通信测试 (iOS)

**优先级**: P0

**测试环境**: iOS 真机或模拟器

**测试步骤**:
1. 在 Safari 中打开 A2UI React 页面
2. 执行 TC-003 (按钮测试)
3. 点击 "点击我" 按钮
4. 检查 Xcode 日志或控制台

**预期结果**:
- ✅ 点击按钮触发桥接调用
- ✅ iOS 原生收到消息（通过 Xcode 日志验证）
- ✅ 消息格式正确，包含 userAction 对象

**实际结果**: _____ 日期: _____

---

### TC-013: 桥接通信测试 (Android)

**优先级**: P0

**测试环境**: Android 真机或模拟器

**测试步骤**:
1. 在 Chrome 中打开 A2UI React 页面
2. 执行 TC-003 (按钮测试)
3. 点击 "点击我" 按钮
4. 使用 `adb logcat` 查看日志：
```bash
adb logcat | grep -i openclaw
```

**预期结果**:
- ✅ 点击按钮触发桥接调用
- ✅ Android 原生收到消息
- ✅ 消息通过 `openclawCanvasA2UIAction` 接口

**实际结果**: _____ 日期: _____

---

### TC-014: 进度条组件测试

**优先级**: P2

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'progress',
          component: {
            Column: {
              children: { explicitList: ['label', 'bar', 'percentage'] },
              spacing: { literalNumber: 8 }
            }
          }
        },
        {
          id: 'label',
          component: {
            Text: {
              text: { literalString: '下载进度' }
            }
          }
        },
        {
          id: 'bar',
          component: {
            Progress: {
              value: { literalNumber: 75 },
              max: { literalNumber: 100 }
            }
          }
        },
        {
          id: 'percentage',
          component: {
            Text: {
              text: { literalString: '75%' }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'progress'
    }
  }
]);
```

**预期结果**:
- ✅ 显示 "下载进度" 标签
- ✅ 显示进度条（75% 位置）
- ✅ 显示 "75%" 文本
- ✅ 进度条有正确的颜色（主题色）

**实际结果**: _____ 日期: _____

---

### TC-015: 分割线组件测试

**优先级**: P2

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'content',
          component: {
            Column: {
              children: { explicitList: ['text1', 'divider', 'text2'] },
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'text1',
          component: {
            Text: { text: { literalString: '上方内容' } }
          }
        },
        {
          id: 'divider',
          component: {
            Divider: {}
          }
        },
        {
          id: 'text2',
          component: {
            Text: { text: { literalString: '下方内容' } }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'content'
    }
  }
]);
```

**预期结果**:
- ✅ 显示两条文本
- ✅ 中间显示水平分割线
- ✅ 上下内容有适当的间距

**实际结果**: _____ 日期: _____

---

### TC-016: 文本样式测试

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['t1', 't2', 't3', 't4'] },
              spacing: { literalNumber: 8 }
            }
          }
        },
        {
          id: 't1',
          component: {
            Text: {
              text: { literalString: 'Small Text' },
              size: 'small'
            }
          }
        },
        {
          id: 't2',
          component: {
            Text: {
              text: { literalString: 'Medium Text' },
              size: 'medium'
            }
          }
        },
        {
          id: 't3',
          component: {
            Text: {
              text: { literalString: 'Large Text' },
              size: 'large'
            }
          }
        },
        {
          id: 't4',
          component: {
            Text: {
              text: { literalString: 'Bold Text' },
              weight: 'bold'
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'root'
    }
  }
]);
```

**预期结果**:
- ✅ 四种不同大小的文本
- ✅ Bold Text 显示为粗体
- ✅ 字体大小有明显差异

**实际结果**: _____ 日期: _____

---

### TC-017: 容器内边距测试

**优先级**: P2

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'container1',
          component: {
            Container: {
              padding: { literalNumber: 8 }
            }
          }
        },
        {
          id: 'container2',
          component: {
            Container: {
              padding: { literalNumber: 32 }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'container1'
    }
  }
]);
```

**预期结果**:
- ✅ 两个容器显示不同的内边距
- ✅ padding=8 的容器内容更紧凑
- ✅ padding=32 的容器内容更宽松

**实际结果**: _____ 日期: _____

---

### TC-018: 错误处理测试

**优先级**: P2

**测试步骤**:
```javascript
// 1. 发送无效消息
try {
  await window.openclawA2UI.applyMessages([
    { invalid: 'message' }
  ]);
} catch (e) {
  console.log('Expected error:', e);
}

// 2. 发送空 Surface
try {
  await window.openclawA2UI.applyMessages([
    {
      surfaceUpdate: {
        surfaceId: 'test',
        components: []
      }
    }
  ]);
} catch (e) {
  console.log('Error:', e);
}
```

**预期结果**:
- ✅ 无效消息被优雅处理（不崩溃）
- ✅ 控制台有错误日志
- ✅ 页面保持稳定

**实际结果**: _____ 日期: _____

---

### TC-019: 复杂 UI 场景 - 表单卡片

**优先级**: P1

**测试步骤**:
```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'form-card',
          component: {
            Card: {
              padding: { literalNumber: 24 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '用户注册' },
              size: 'xlarge',
              weight: 'bold'
            }
          }
        },
        {
          id: 'divider',
          component: {
            Divider: {}
          }
        },
        {
          id: 'form-fields',
          component: {
            Column: {
              children: { explicitList: ['username', 'password', 'register-btn'] },
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'username',
          component: {
            TextField: {
              label: { literalString: '用户名' },
              placeholder: { literalString: '请输入用户名' }
            }
          }
        },
        {
          id: 'password',
          component: {
            TextField: {
              label: { literalString: '密码' },
              placeholder: { literalString: '请输入密码' },
              secret: { literalBoolean: true }
            }
          }
        },
        {
          id: 'register-btn',
          component: {
            Button: {
              text: { literalString: '注册' },
              action: {
                name: 'user_register',
                surfaceId: 'main',
                context: []
              }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'form-card'
    }
  }
]);
```

**预期结果**:
- ✅ 显示完整的注册表单卡片
- ✅ 标题、分割线、表单字段层次清晰
- ✅ 密码输入框显示为密码类型（隐藏内容）
- ✅ "注册" 按钮可点击
- ✅ 整体布局美观，间距合理

**实际结果**: _____ 日期: _____

---

### TC-020: 性能测试 - 大量组件

**优先级**: P2

**测试步骤**:
```javascript
// 创建包含 50 个组件的消息
const components = [];
for (let i = 0; i < 50; i++) {
  components.push({
    id: `item-${i}`,
    component: {
      Text: {
        text: { literalString: `Item ${i}` }
      }
    }
  });
}

await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'item-0'
    }
  }
]);
```

**预期结果**:
- ✅ 50 个组件成功渲染
- ✅ 页面响应流畅，无明显卡顿
- ✅ 渲染时间 < 1 秒

**实际结果**: _____ 日期: _____

---

### TC-021: 平台适配测试

**优先级**: P0

**测试环境**:
- iOS Safari (iOS 13+)
- Android Chrome
- 桌面 Chrome

**测试步骤**:
1. 在各平台上执行 TC-002
2. 检查平台检测：
```javascript
console.log('Platform:', window.openclawA2UIInternal?.getSurfacesState?.().platform);
```

**预期结果**:
- ✅ iOS 上识别为 'ios' 平台
- ✅ Android 上识别为 'android' 平台
- ✅ 桌面浏览器识别为 'unknown'
- ✅ 各平台 UI 样式一致

**实际结果**: _____ 日期: _____

---

### TC-022: 安全区域适配 (iOS 刘海屏)

**优先级**: P2

**测试环境**: iPhone X 或更新机型（带刘海屏）

**测试步骤**:
1. 在 iPhone 上打开 A2UI React
2. 执行 TC-003 (按钮测试)
3. 观察顶部和底部是否有安全区域

**预期结果**:
- ✅ 内容不被刘海屏遮挡
- ✅ 顶部和底部有适当的内边距
- ✅ 使用 `env(safe-area-inset-*)` CSS 变量

**实际结果**: _____ 日期: _____

---

## 测试执行记录模板

### 测试人员信息
- 测试人员: _____
- 测试日期: _____
- 测试设备: _____
- 浏览器/版本: _____

### 测试结果汇总
| 用例 ID | 用例名称 | 优先级 | 结果 | 备注 |
|---------|---------|--------|------|------|
| TC-001 | 基础页面加载 | P0 | ⬜ | |
| TC-002 | 简单文本渲染 | P0 | ⬜ | |
| TC-003 | 按钮组件 | P0 | ⬜ | |
| TC-004 | 表单输入 | P1 | ⬜ | |
| TC-005 | 卡片组件 | P1 | ⬜ | |
| TC-006 | 图片组件 | P1 | ⬜ | |
| TC-007 | 布局组件 | P1 | ⬜ | |
| TC-008 | 主题切换 | P2 | ⬜ | |
| TC-009 | 数据绑定 | P1 | ⬜ | |
| TC-010 | 多 Surface | P2 | ⬜ | |
| TC-011 | Reset 功能 | P1 | ⬜ | |
| TC-012 | iOS 桥接 | P0 | ⬜ | |
| TC-013 | Android 桥接 | P0 | ⬜ | |
| TC-014 | 进度条 | P2 | ⬜ | |
| TC-015 | 分割线 | P2 | ⬜ | |
| TC-016 | 文本样式 | P1 | ⬜ | |
| TC-017 | 容器内边距 | P2 | ⬜ | |
| TC-018 | 错误处理 | P2 | ⬜ | |
| TC-019 | 复杂 UI | P1 | ⬜ | |
| TC-020 | 性能测试 | P2 | ⬜ | |
| TC-021 | 平台适配 | P0 | ⬜ | |
| TC-022 | 安全区域 | P2 | ⬜ | |

**通过率**: ___/22

**阻塞问题**: _____
**建议改进**: _____
