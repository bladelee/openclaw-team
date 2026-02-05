# A2UI React 使用示例

## 基础示例

### 创建简单按钮

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
              children: { explicitList: ['title', 'button'] },
              alignment: 'center',
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '欢迎使用 OpenClaw' },
              size: 'xlarge',
              weight: 'bold'
            }
          }
        },
        {
          id: 'button',
          component: {
            Button: {
              text: { literalString: '点击我' },
              action: {
                name: 'hello_click',
                surfaceId: 'main',
                context: [
                  { key: 'source', value: { literalString: 'example' } }
                ]
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

### 表单输入

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
              children: { explicitList: ['name', 'email', 'submit'] },
              spacing: { literalNumber: 12 }
            }
          }
        },
        {
          id: 'name',
          component: {
            TextField: {
              label: { literalString: '姓名' },
              placeholder: { literalString: '请输入姓名' }
            }
          }
        },
        {
          id: 'email',
          component: {
            TextField: {
              label: { literalString: '邮箱' },
              placeholder: { literalString: '请输入邮箱地址' }
            }
          }
        },
        {
          id: 'submit',
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

### 图片展示

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
              padding: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'image',
          component: {
            Image: {
              url: { literalString: 'https://example.com/photo.jpg' },
              alt: { literalString: '示例图片' },
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
      root: 'card'
    }
  }
]);
```

## 高级示例

### 数据绑定

```javascript
// 1. 先设置数据模型
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
            Text: {
              text: { path: '/user/name' },  // 从数据模型读取
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
      root: 'info'
    }
  }
]);
```

### 列表渲染

```javascript
// 动态生成多个组件
function createListItem(id: string, text: string, index: number) {
  return {
    id: `item-${index}`,
    component: {
      Row: {
        children: { explicitList: [`text-${index}`, `action-${index}`] },
        spacing: { literalNumber: 8 }
      }
    }
  };
}

const components = [
  {
    id: 'list',
    component: {
      Column: {
        children: { explicitList: ['item-0', 'item-1', 'item-2'] },
        spacing: { literalNumber: 8 }
      }
    }
  },
  ...['项目 A', '项目 B', '项目 C'].map((text, i) => ({
    id: `item-${i}`,
    component: {
      Card: {
        padding: { literalNumber: 12 }
      }
    }
  })),
  ...['项目 A', '项目 B', '项目 C'].map((text, i) => ({
    id: `text-${i}`,
    component: {
      Text: {
        text: { literalString: text }
      }
    }
  })),
  ...['项目 A', '项目 B', '项目 C'].map((text, i) => ({
    id: `action-${i}`,
    component: {
      Button: {
        text: { literalString: '查看' },
        action: {
          name: 'view_item',
          surfaceId: 'main',
          context: [
            { key: 'index', value: { literalNumber: i } },
            { key: 'name', value: { literalString: text } }
          ]
        }
      }
    }
  }))
];

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
      root: 'list'
    }
  }
]);
```

### 进度条

```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'progress-container',
          component: {
            Column: {
              children: { explicitList: ['label', 'progress', 'percentage'] },
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
          id: 'progress',
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
              text: { literalString: '75%' },
              align: 'center'
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'progress-container'
    }
  }
]);
```

### 模态框

```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'modal',
          component: {
            Modal: {
              title: { literalString: '确认操作' },
              content: { literalString: '您确定要执行此操作吗？' },
              dismissible: { literalBoolean: true },
              onDismiss: {
                name: 'modal_dismiss',
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
      root: 'modal'
    }
  }
]);
```

## 实际场景

### 登录界面

```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'login-container',
          component: {
            Container: {
              padding: { literalNumber: 24 }
            }
          }
        },
        {
          id: 'logo',
          component: {
            Column: {
              children: { explicitList: ['title'] },
              alignment: 'center',
              spacing: { literalNumber: 24 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '欢迎登录' },
              size: 'xlarge',
              weight: 'bold'
            }
          }
        },
        {
          id: 'username-field',
          component: {
            TextField: {
              label: { literalString: '用户名' },
              placeholder: { literalString: '请输入用户名' }
            }
          }
        },
        {
          id: 'password-field',
          component: {
            TextField: {
              label: { literalString: '密码' },
              placeholder: { literalString: '请输入密码' },
              secret: { literalBoolean: true }
            }
          }
        },
        {
          id: 'login-button',
          component: {
            Button: {
              text: { literalString: '登录' },
              action: {
                name: 'user_login',
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
      root: 'login-container'
    }
  }
]);
```

### 个人资料卡片

```javascript
await window.openclawA2UI.applyMessages([
  {
    dataModelUpdate: {
      surfaceId: 'main',
      path: '/profile',
      contents: [
        { key: 'name', valueString: '张三' },
        { key: 'bio', valueString: '全栈开发工程师' },
        { key: 'followers', valueNumber: 1234 },
        { key: 'following', valueNumber: 567 }
      ]
    }
  },
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'profile-card',
          component: {
            Card: {
              padding: { literalNumber: 20 }
            }
          }
        },
        {
          id: 'name',
          component: {
            Text: {
              text: { path: '/profile/name' },
              size: 'large',
              weight: 'bold'
            }
          }
        },
        {
          id: 'bio',
          component: {
            Text: {
              text: { path: '/profile/bio' },
              size: 'medium',
              color: '#94a3b8'
            }
          }
        },
        {
          id: 'stats',
          component: {
            Row: {
              children: { explicitList: ['followers', 'following'] },
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'followers',
          component: {
            Text: {
              text: { literalString: '1234 粉丝' }
            }
          }
        },
        {
          id: 'following',
          component: {
            Text: {
              text: { literalString: '567 关注' }
            }
          }
        },
        {
          id: 'follow-button',
          component: {
            Button: {
              text: { literalString: '+ 关注' },
              action: {
                name: 'follow_user',
                surfaceId: 'main',
                context: [
                  { key: 'userId', value: { literalString: '123' } }
                ]
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
      root: 'profile-card'
    }
  }
]);
```

### 音频播放器

```javascript
await window.openclawA2UI.applyMessages([
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'audio-card',
          component: {
            Card: {
              padding: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: '示例音频' },
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
          id: 'player',
          component: {
            AudioPlayer: {
              url: { literalString: 'https://example.com/audio.mp3' },
              autoplay: { literalBoolean: false },
              loop: { literalBoolean: false }
            }
          }
        }
      ]
    }
  },
  {
    beginRendering: {
      surfaceId: 'main',
      root: 'audio-card'
    }
  }
]);
```

## 处理响应

### 监听动作状态

```javascript
// 监听动作完成事件
window.addEventListener('openclaw:a2ui-action-status', (event) => {
  const { id, ok, error } = event.detail;

  if (ok) {
    console.log(`✅ 动作 ${id} 执行成功`);
    // 可以更新 UI 显示成功状态
  } else {
    console.error(`❌ 动作 ${id} 失败:`, error);
    // 可以更新 UI 显示错误信息
  }
});

// 发送动作
OpenClaw.sendUserAction({
  name: 'save_data',
  surfaceId: 'main',
  sourceComponentId: 'save-button',
  timestamp: new Date().toISOString(),
  context: { data: 'example' }
});
```

### 动态更新数据

```javascript
// 1. 设置初始数据
await window.openclawA2UI.applyMessages([
  {
    dataModelUpdate: {
      surfaceId: 'main',
      path: '/counter',
      contents: [
        { key: 'count', valueNumber: 0 }
      ]
    }
  }
]);

// 2. 监听按钮点击，更新计数
window.addEventListener('openclaw:a2ui-action-status', async (event) => {
  if (event.detail.id === 'increment') {
    // 获取当前值
    const currentCount = /* 从某处获取当前值 */ 0;

    // 更新数据模型
    await window.openclawA2UI.applyMessages([
      {
        dataModelUpdate: {
          surfaceId: 'main',
          path: '/counter',
          contents: [
            { key: 'count', valueNumber: currentCount + 1 }
          ]
        }
      }
    ]);
  }
});
```
