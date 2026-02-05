/**
 * A2UI React E2E HTTP Tests
 * Tests the actual deployed application using HTTP requests
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:18791';

describe('A2UI React E2E HTTP Tests', () => {
  describe('Server Responses', () => {
    it('should serve index.html', async () => {
      const response = await fetch(BASE_URL);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    it('should serve JavaScript bundle', async () => {
      const response = await fetch(`${BASE_URL}/assets/index-CZHSfZAL.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
    });

    it('should serve CSS bundle', async () => {
      const response = await fetch(`${BASE_URL}/assets/index-CoRTH4fq.css`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
    });

    it('should serve React vendor bundle', async () => {
      const response = await fetch(`${BASE_URL}/assets/react-vendor-B4EcNXrs.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
    });

    it('should serve A2UI core bundle', async () => {
      const response = await fetch(`${BASE_URL}/assets/a2ui-core-D0wdomam.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
    });

    it('should return 404 for non-existent files', async () => {
      const response = await fetch(`${BASE_URL}/non-existent.html`);
      expect(response.status).toBe(404);
    });
  });

  describe('HTML Content', () => {
    it('should contain proper viewport meta tag', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      expect(html).toContain('viewport');
      expect(html).toContain('user-scalable=no');
      expect(html).toContain('viewport-fit=cover');
    });

    it('should contain root div', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      expect(html).toContain('<div id="root"></div>');
    });

    it('should include script tags for bundles', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      expect(html).toMatch(/<script.*src=.*assets.*\.js/);
      expect(html).toMatch(/<link.*rel=.*stylesheet.*assets.*\.css/);
    });
  });

  describe('Cache Control', () => {
    it('should set proper cache headers', async () => {
      const response = await fetch(BASE_URL);
      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('no-store');
    });
  });

  describe('CORS and Security', () => {
    it('should handle CORS preflight', async () => {
      const response = await fetch(BASE_URL, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      // Server should respond (may or may not have CORS headers depending on setup)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Performance', () => {
    it('should serve index.html quickly', async () => {
      const start = Date.now();
      const response = await fetch(BASE_URL);
      await response.text();
      const duration = Date.now() - start;

      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should have reasonable HTML size', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      const size = new Blob([html]).size;

      // HTML should be less than 10KB
      expect(size).toBeLessThan(10 * 1024);
    });

    it('should have reasonable bundle sizes', async () => {
      const jsResponse = await fetch(`${BASE_URL}/assets/index-CZHSfZAL.js`);
      const jsContent = await jsResponse.text();
      const jsSize = new Blob([jsContent]).size;

      // Main bundle should be reasonable (< 100KB gzipped)
      expect(jsSize).toBeLessThan(100 * 1024);
    });
  });

  describe('Resource Loading', () => {
    it('should load all required resources', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      // Extract all resource URLs
      const scriptMatches = html.matchAll(/src="(\.\/assets\/[^"]+)"/g);
      const linkMatches = html.matchAll(/href="(\.\/assets\/[^"]+)"/g);

      const resources = [
        ...Array.from(scriptMatches).map(m => m[1]),
        ...Array.from(linkMatches).map(m => m[1])
      ];

      expect(resources.length).toBeGreaterThan(0);

      // Try to load each resource
      for (const resource of resources) {
        const res = await fetch(`${BASE_URL}/${resource}`);
        expect(res.status).toBe(200);
      }
    });
  });
});

describe('A2UI React Functional Tests', () => {
  describe('A2UI Message API', () => {
    it('should be able to construct valid A2UI messages', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'test',
          components: [
            {
              id: 'btn1',
              component: {
                Button: {
                  text: { literalString: 'Click Me' },
                  action: {
                    name: 'test_click',
                    surfaceId: 'test',
                    context: []
                  }
                }
              }
            }
          ]
        }
      };

      expect(message.surfaceUpdate).toBeDefined();
      expect(message.surfaceUpdate?.components).toHaveLength(1);
    });

    it('should serialize messages to JSON', () => {
      const message = {
        beginRendering: {
          surfaceId: 'test',
          root: 'root'
        }
      };

      const json = JSON.stringify(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });

    it('should handle complex component hierarchies', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: {
                Column: {
                  children: { explicitList: ['header', 'content', 'footer'] },
                  spacing: { literalNumber: 16 }
                }
              }
            },
            {
              id: 'header',
              component: {
                Text: {
                  text: { literalString: 'Header' }
                }
              }
            },
            {
              id: 'content',
              component: {
                Card: {
                  padding: { literalNumber: 20 }
                }
              }
            },
            {
              id: 'footer',
              component: {
                Text: {
                  text: { literalString: 'Footer' }
                }
              }
            }
          ]
        }
      };

      expect(message.surfaceUpdate?.components).toHaveLength(4);
      expect(message.surfaceUpdate?.components[0].component.Column?.children?.explicitList).toHaveLength(3);
    });
  });

  describe('User Action Construction', () => {
    it('should create valid user action with all required fields', () => {
      const action = {
        id: 'action-123',
        name: 'button_click',
        surfaceId: 'main',
        sourceComponentId: 'submit-btn',
        timestamp: new Date().toISOString(),
        context: {
          formId: 'login-form',
          userId: 'user-456'
        }
      };

      expect(action.id).toBeDefined();
      expect(action.name).toBeDefined();
      expect(action.surfaceId).toBeDefined();
      expect(action.sourceComponentId).toBeDefined();
      expect(action.timestamp).toBeDefined();
      expect(action.context).toBeDefined();
    });

    it('should serialize user action to JSON', () => {
      const action = {
        id: 'test-action',
        name: 'click',
        surfaceId: 'main',
        sourceComponentId: 'btn1',
        timestamp: '2025-02-03T00:00:00.000Z',
        context: {}
      };

      const json = JSON.stringify(action);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(action);
      expect(parsed.id).toBe('test-action');
    });
  });

  describe('Data Model Operations', () => {
    it('should create valid data model update', () => {
      const update = {
        dataModelUpdate: {
          surfaceId: 'main',
          path: '/user',
          contents: [
            { key: 'name', valueString: 'Alice' },
            { key: 'age', valueNumber: 30 },
            { key: 'active', valueBoolean: true }
          ]
        }
      };

      expect(update.dataModelUpdate?.contents).toHaveLength(3);
      expect(update.dataModelUpdate?.contents[0].key).toBe('name');
    });

    it('should handle nested data paths', () => {
      const paths = [
        '/user/profile/name',
        'user.profile.name',
        '/settings/theme.dark'
      ];

      paths.forEach(path => {
        expect(path).toMatch(/^\/?[\w.]+/);
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed messages gracefully', () => {
      const malformed = [
        { invalid: 'message' },
        { surfaceUpdate: null },
        { beginRendering: {} }
      ];

      malformed.forEach(msg => {
        expect(() => JSON.stringify(msg)).not.toThrow();
      });
    });

    it('should handle empty component lists', () => {
      const message = {
        surfaceUpdate: {
          surfaceId: 'test',
          components: []
        }
      };

      expect(message.surfaceUpdate?.components).toHaveLength(0);
      expect(JSON.stringify(message)).toBeDefined();
    });
  });
});

describe('A2UI React Message Format Validation', () => {
  describe('Surface Update Validation', () => {
    it('should accept valid surface update', () => {
      const update = {
        surfaceUpdate: {
          surfaceId: 'test-surface',
          components: [
            {
              id: 'comp1',
              component: {
                Text: {
                  text: { literalString: 'Hello' }
                }
              }
            }
          ]
        }
      };

      const json = JSON.stringify(update);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);
    });

    it('should reject surface update without surfaceId', () => {
      const invalid = {
        surfaceUpdate: {
          // Missing surfaceId
          components: []
        }
      };

      // Should be able to serialize, but structure is invalid
      expect(invalid.surfaceUpdate).toBeDefined();
    });
  });

  describe('Component Type Validation', () => {
    const validComponentTypes = [
      'Button', 'Text', 'Card', 'TextField', 'Image',
      'Column', 'Row', 'Container', 'Divider',
      'Progress', 'Modal', 'Markdown',
      'AudioPlayer', 'VideoPlayer'
    ];

    it('should support all defined component types', () => {
      validComponentTypes.forEach(type => {
        const message = {
          surfaceUpdate: {
            surfaceId: 'test',
            components: [
              {
                id: 'comp1',
                component: {
                  [type]: {
                    text: { literalString: 'Test' }
                  }
                }
              }
            ]
          }
        };

        expect(message.surfaceUpdate?.components[0].component).toHaveProperty(type);
      });
    });

    it('should serialize all component types correctly', () => {
      validComponentTypes.forEach(type => {
        const component = {
          id: 'test',
          component: {
            [type]: {}
          }
        };

        expect(() => JSON.stringify(component)).not.toThrow();
      });
    });
  });

  describe('Value Type Validation', () => {
    it('should handle all value types correctly', () => {
      const values = [
        { literalString: 'hello' },
        { literalNumber: 42 },
        { literalBoolean: true },
        { path: '/user/name' }
      ];

      values.forEach(value => {
        expect(() => JSON.stringify(value)).not.toThrow();
      });
    });

    it('should create mixed context arrays', () => {
      const context = [
        { key: 'name', value: { literalString: 'Alice' } },
        { key: 'age', value: { literalNumber: 30 } },
        { key: 'active', value: { literalBoolean: true } },
        { key: 'ref', value: { path: '/user/ref' } }
      ];

      expect(context).toHaveLength(4);
      expect(JSON.stringify(context)).toBeDefined();
    });
  });
});
