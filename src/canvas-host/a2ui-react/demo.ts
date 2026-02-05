/**
 * A2UI React Test/Demo Page
 * Demonstrates A2UI message processing and rendering
 */

import { useEffect } from 'react';
import { useA2uiMessages } from './context/A2uiMessageContext';

/**
 * Demo A2UI Messages
 */
const DEMO_MESSAGES = [
  // Create a simple UI with a button
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: { explicitList: ['title', 'description', 'button'] },
              alignment: 'center',
              spacing: { literalNumber: 16 }
            }
          }
        },
        {
          id: 'title',
          component: {
            Text: {
              text: { literalString: 'OpenClaw A2UI React' },
              size: 'xlarge',
              weight: 'bold',
              usageHint: 'title'
            }
          }
        },
        {
          id: 'description',
          component: {
            Text: {
              text: { literalString: 'H5 移动端 A2UI 协议实现' },
              size: 'medium',
              usageHint: 'body'
            }
          }
        },
        {
          id: 'button',
          component: {
            Button: {
              text: { literalString: '点击测试' },
              action: {
                name: 'test_click',
                surfaceId: 'main',
                context: [
                  { key: 'source', value: { literalString: 'a2ui-react-demo' } }
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
];

/**
 * Demo component that loads sample A2UI messages
 */
export const A2uiDemo: React.FC = () => {
  const { applyMessages } = useA2uiMessages();

  useEffect(() => {
    // Apply demo messages on mount
    applyMessages(DEMO_MESSAGES as unknown[]);
  }, [applyMessages]);

  return null; // This is a side-effect component only
};

/**
 * Export demo messages for external use
 */
export const getDemoMessages = () => DEMO_MESSAGES;
