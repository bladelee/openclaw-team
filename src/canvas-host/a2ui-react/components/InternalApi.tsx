/**
 * Internal API Component
 * Exposes the A2UI API to window.openclawA2UIInternal for bridge communication
 */

import React, { useEffect } from 'react';
import { useA2uiMessages } from '../context/A2uiMessageContext';
import type { A2uiMessage } from '../types';

export const A2uiInternalApi: React.FC = () => {
  const { surfaces, applyMessages, reset, getSurfaces } = useA2uiMessages();

  useEffect(() => {
    // Expose internal API to window object
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).openclawA2UIInternal = {
        /**
         * Apply A2UI messages to update the UI
         */
        async applyMessages(messages: A2uiMessage[]): Promise<{ ok: boolean; surfaces?: string[]; error?: string }> {
          try {
            const result = await applyMessages(messages);
            return { ok: true, surfaces: result.surfaces };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },

        /**
         * Reset all surfaces
         */
        async reset(): Promise<{ ok: boolean; error?: string }> {
          try {
            const result = reset();
            return { ok: result.ok };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },

        /**
         * Get list of surface IDs
         */
        getSurfaces(): string[] {
          return getSurfaces();
        },

        /**
         * Get current surfaces state
         */
        getSurfacesState(): Map<string, unknown> {
          return surfaces as unknown as Map<string, unknown>;
        }
      };

      console.log('[A2UI React] Internal API exposed at window.openclawA2UIInternal');
    }

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as Record<string, unknown>).openclawA2UIInternal;
      }
    };
  }, [surfaces, applyMessages, reset, getSurfaces]);

  // This component renders nothing
  return null;
};

export default A2uiInternalApi;
