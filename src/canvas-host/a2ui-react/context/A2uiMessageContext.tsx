/**
 * A2UI Message Context
 * Manages A2UI message processing and surface state
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { A2uiMessageAdapter } from '../services/messageAdapter';
import type { A2uiMessage, Surface, ComponentContextValue } from '../types';

interface A2uiMessageContextValue {
  surfaces: Map<string, Surface>;
  applyMessages: (messages: A2uiMessage[]) => Promise<{ ok: boolean; surfaces: string[] }>;
  reset: () => { ok: boolean };
  getSurfaces: () => string[];
  resolveContextValues: (surfaceId: string, context?: ComponentContextValue[]) => Record<string, unknown>;
}

const A2uiMessageContext = createContext<A2uiMessageContextValue | undefined>(undefined);

export const A2uiMessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adapter] = useState(() => new A2uiMessageAdapter());
  const [surfaces, setSurfaces] = useState<Map<string, Surface>>(new Map());

  useEffect(() => {
    const unsubscribe = adapter.subscribe((newSurfaces) => {
      setSurfaces(new Map(newSurfaces));
    });

    return unsubscribe;
  }, [adapter]);

  const applyMessages = useCallback(async (messages: A2uiMessage[]) => {
    return await adapter.applyMessages(messages);
  }, [adapter]);

  const reset = useCallback(() => {
    return adapter.reset();
  }, [adapter]);

  const getSurfaces = useCallback(() => {
    return adapter.getSurfaces();
  }, [adapter]);

  const resolveContextValues = useCallback((surfaceId: string, context?: ComponentContextValue[]) => {
    return adapter.resolveContextValues(surfaceId, context);
  }, [adapter]);

  const contextValue = useMemo(() => ({
    surfaces,
    applyMessages,
    reset,
    getSurfaces,
    resolveContextValues
  }), [surfaces, applyMessages, reset, getSurfaces, resolveContextValues]);

  return (
    <A2uiMessageContext.Provider value={contextValue}>
      {children}
    </A2uiMessageContext.Provider>
  );
};

export const useA2uiMessages = () => {
  const context = useContext(A2uiMessageContext);
  if (!context) {
    throw new Error('useA2uiMessages 必须在 A2uiMessageProvider 内使用');
  }
  return context;
};
