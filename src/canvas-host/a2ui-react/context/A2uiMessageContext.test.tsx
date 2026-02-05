/**
 * A2UI Message Context Tests
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { A2uiMessageProvider, useA2uiMessages } from './A2uiMessageContext';
import type { A2uiMessage } from '../types';

describe('A2uiMessageContext', () => {
  it('should initialize with empty surfaces', () => {
    const { result } = renderHook(() => useA2uiMessages(), {
      wrapper: A2uiMessageProvider
    });

    expect(result.current.surfaces.size).toBe(0);
    expect(result.current.getSurfaces()).toEqual([]);
  });

  it('should apply messages and create surfaces', async () => {
    const { result } = renderHook(() => useA2uiMessages(), {
      wrapper: A2uiMessageProvider
    });

    const messages: A2uiMessage[] = [
      {
        surfaceUpdate: {
          surfaceId: 'test',
          components: [
            {
              id: 'root',
              component: { Column: { children: { explicitList: [] } } }
            }
          ]
        }
      },
      {
        beginRendering: { surfaceId: 'test', root: 'root' }
      }
    ];

    await act(async () => {
      const applyResult = await result.current.applyMessages(messages);
      expect(applyResult.ok).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.surfaces.size).toBe(1);
      expect(result.current.getSurfaces()).toContain('test');
    });
  });

  it('should reset all surfaces', () => {
    const { result } = renderHook(() => useA2uiMessages(), {
      wrapper: A2uiMessageProvider
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.surfaces.size).toBe(0);
  });

  it('should resolve context values with literal values', async () => {
    const { result } = renderHook(() => useA2uiMessages(), {
      wrapper: A2uiMessageProvider
    });

    // First create a surface with data model
    const messages: A2uiMessage[] = [
      {
        surfaceUpdate: {
          surfaceId: 'test',
          components: [
            {
              id: 'root',
              component: { Column: { children: { explicitList: [] } } }
            }
          ]
        }
      },
      {
        beginRendering: { surfaceId: 'test', root: 'root' }
      },
      {
        dataModelUpdate: {
          surfaceId: 'test',
          contents: [
            { key: 'name', valueString: 'Test Value' }
          ]
        }
      }
    ];

    await act(async () => {
      await result.current.applyMessages(messages);
    });

    const context = result.current.resolveContextValues('test', [
      { key: 'key1', value: { literalString: 'value1' } },
      { key: 'key2', value: { literalNumber: 42 } },
      { key: 'key3', value: { literalBoolean: true } }
    ]);

    expect(context).toEqual({
      key1: 'value1',
      key2: 42,
      key3: true
    });
  });
});
