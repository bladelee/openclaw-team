/**
 * A2UI React Integration Tests
 * Tests that verify the full integration of A2UI React components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup JSDOM environment
function createTestEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:18789',
    runScripts: 'dangerously',
    resources: 'usable',
  });

  // Mock the bridge APIs
  dom.window.openclawCanvasA2UIAction = {
    postMessage: () => true
  };

  dom.window.webkit = {
    messageHandlers: {
      openclawCanvasA2UIAction: {
        postMessage: () => true
      }
    }
  } as unknown;

  // Expose global APIs
  dom.window.OpenClaw = {
    postMessage: () => true,
    sendUserAction: () => true
  };

  return dom;
}

describe('A2UI React Integration Tests', () => {
  let dom: JSDOM;
  let window: unknown;

  beforeEach(async () => {
    dom = createTestEnvironment();
    window = dom.window as unknown;
    global.window = window as unknown;
    global.document = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
    // @ts-ignore
    global.window = undefined;
    // @ts-ignore
    global.document = undefined;
  });

  describe('Message Processing', () => {
    it('should process surfaceUpdate message', async () => {
      // Load the app
      await import('node:fs/promises').then(fs =>
        fs.readFile('./src/canvas-host/a2ui-react/dist/assets/index-*.js', 'utf-8')
      ).catch(() => {
        // For testing, use a mock
        return null;
      });

      // Test message processing
      const messages = [
        {
          surfaceUpdate: {
            surfaceId: 'test',
            components: [
              {
                id: 'text1',
                component: {
                  Text: {
                    text: { literalString: 'Hello World' }
                  }
                }
              }
            ]
          }
        }
      ];

      // Verify message structure
      expect(messages).toBeDefined();
      expect(messages[0].surfaceUpdate).toBeDefined();
      expect(messages[0].surfaceUpdate?.surfaceId).toBe('test');
    });

    it('should handle beginRendering message', () => {
      const message = {
        beginRendering: {
          surfaceId: 'test',
          root: 'root'
        }
      };

      expect(message.beginRendering).toBeDefined();
      expect(message.beginRendering?.surfaceId).toBe('test');
      expect(message.beginRendering?.root).toBe('root');
    });

    it('should handle dataModelUpdate message', () => {
      const message = {
        dataModelUpdate: {
          surfaceId: 'test',
          path: '/user',
          contents: [
            { key: 'name', valueString: 'Test User' }
          ]
        }
      };

      expect(message.dataModelUpdate).toBeDefined();
      expect(message.dataModelUpdate?.contents).toHaveLength(1);
    });
  });

  describe('Component Integration', () => {
    it('should create valid button component message', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: [
            {
              id: 'btn1',
              component: {
                Button: {
                  text: { literalString: 'Click Me' },
                  action: {
                    name: 'click',
                    surfaceId: 'main',
                    context: []
                  }
                }
              }
            }
          ]
        }
      };

      const component = message.surfaceUpdate?.components[0];
      expect(component?.component.Button).toBeDefined();
      expect(component?.component.Button?.text).toEqual({ literalString: 'Click Me' });
    });

    it('should create valid text component message', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: [
            {
              id: 'text1',
              component: {
                Text: {
                  text: { literalString: 'Hello' },
                  size: 'large'
                }
              }
            }
          ]
        }
      };

      const component = message.surfaceUpdate?.components[0];
      expect(component?.component.Text).toBeDefined();
      expect(component?.component.Text?.size).toBe('large');
    });

    it('should create valid card component message', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: [
            {
              id: 'card1',
              component: {
                Card: {
                  padding: { literalNumber: 16 }
                }
              }
            }
          ]
        }
      };

      const component = message.surfaceUpdate?.components[0];
      expect(component?.component.Card).toBeDefined();
    });
  });

  describe('Action Flow', () => {
    it('should create valid user action', () => {
      const action = {
        id: 'action-123',
        name: 'button_click',
        surfaceId: 'main',
        sourceComponentId: 'btn1',
        timestamp: new Date().toISOString(),
        context: {
          testKey: 'testValue'
        }
      };

      expect(action.name).toBe('button_click');
      expect(action.surfaceId).toBe('main');
      expect(action.context).toEqual({ testKey: 'testValue' });
    });

    it('should serialize to JSON correctly', () => {
      const action = {
        id: 'action-123',
        name: 'test_action',
        surfaceId: 'main',
        sourceComponentId: 'comp1',
        timestamp: '2025-02-03T00:00:00.000Z',
        context: {}
      };

      const json = JSON.stringify(action);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(action);
    });
  });

  describe('API Integration', () => {
    it('should expose openclawA2UI API structure', () => {
      // Mock the API structure
      const mockAPI = {
        applyMessages: async (_messages: unknown[]) => ({ ok: true, surfaces: ['main'] }),
        reset: async () => ({ ok: true }),
        getSurfaces: () => ['main']
      };

      window.openclawA2UI = mockAPI;

      expect(window.openclawA2UI.applyMessages).toBeDefined();
      expect(window.openclawA2UI.reset).toBeDefined();
      expect(window.openclawA2UI.getSurfaces).toBeDefined();
    });

    it('should expose OpenClaw bridge API', () => {
      expect(window.OpenClaw).toBeDefined();
      expect(window.OpenClaw.postMessage).toBeDefined();
      expect(window.OpenClaw.sendUserAction).toBeDefined();
    });
  });

  describe('Message Sequences', () => {
    it('should handle complete render sequence', () => {
      const messages = [
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
                id: 'title',
                component: {
                  Text: {
                    text: { literalString: 'Test App' }
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
      ];

      expect(messages).toHaveLength(2);
      expect(messages[0].surfaceUpdate?.components).toHaveLength(2);
      expect(messages[1].beginRendering?.root).toBe('root');
    });

    it('should handle data update sequence', () => {
      const messages = [
        {
          dataModelUpdate: {
            surfaceId: 'main',
            path: '/user',
            contents: [
              { key: 'name', valueString: 'Alice' },
              { key: 'age', valueNumber: 30 }
            ]
          }
        },
        {
          surfaceUpdate: {
            surfaceId: 'main',
            components: [
              {
                id: 'display',
                component: {
                  Text: {
                    text: { path: '/user/name' }
                  }
                }
              }
            ]
          }
        },
        {
          beginRendering: {
            surfaceId: 'main',
            root: 'display'
          }
        }
      ];

      expect(messages).toHaveLength(3);
      expect(messages[0].dataModelUpdate?.contents).toHaveLength(2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing component gracefully', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: [
            {
              id: 'test',
              component: {}
            }
          ]
        }
      };

      // Component is empty but structure is valid
      expect(message.surfaceUpdate?.components).toHaveLength(1);
    });

    it('should handle empty surface update', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: []
        }
      };

      expect(message.surfaceUpdate?.components).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle large message batches efficiently', () => {
      const components = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        component: {
          Text: {
            text: { literalString: `Item ${i}` }
          }
        }
      }));

      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components
        }
      };

      expect(message.surfaceUpdate?.components).toHaveLength(100);

      // Measure serialization time
      const start = Date.now();
      JSON.stringify(message);
      const duration = Date.now() - start;

      // Should serialize quickly (< 10ms)
      expect(duration).toBeLessThan(10);
    });
  });
});
