/**
 * A2UI React Test Utilities
 * Helper functions for testing
 */

import { render } from '@testing-library/react';
import { A2uiMessageProvider, A2uiThemeProvider, A2uiActionProvider } from '../context';

/**
 * Render components with all providers
 */
export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <A2uiThemeProvider>
      <A2uiMessageProvider>
        <A2uiActionProvider>
          {ui}
        </A2uiActionProvider>
      </A2uiMessageProvider>
    </A2uiThemeProvider>
  );
}

/**
 * Create mock A2UI message
 */
export function createMockMessage(overrides = {}) {
  return {
    surfaceUpdate: {
      surfaceId: 'test',
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['title'] },
              alignment: 'start',
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: 'Test Title' },
              size: 'large'
            }
          }
        }
      ]
    },
    beginRendering: {
      surfaceId: 'test',
      root: 'root'
    },
    ...overrides
  };
}

/**
 * Create mock action
 */
export function createMockAction(overrides = {}) {
  return {
    name: 'test_action',
    surfaceId: 'test',
    context: [
      { key: 'test', value: { literalString: 'test_value' } }
    ],
    ...overrides
  };
}
