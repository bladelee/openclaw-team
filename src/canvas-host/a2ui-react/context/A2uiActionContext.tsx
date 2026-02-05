/**
 * A2UI Action Context
 * Manages pending action state and toast notifications
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { PendingAction, Toast } from '../types';

interface A2uiActionContextValue {
  pendingAction: PendingAction | null;
  toast: Toast | null;
  setPendingAction: (action: PendingAction | null) => void;
  setToast: (toast: Toast | null) => void;
}

const A2uiActionContext = createContext<A2uiActionContextValue | undefined>(undefined);

export const A2uiActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Listen for action status events
  useEffect(() => {
    const handleStatus = (evt: Event) => {
      const customEvent = evt as CustomEvent<{ id: string; ok: boolean; error?: string }>;
      const { id, ok, error } = customEvent.detail;

      if (pendingAction?.id !== id) {
        return;
      }

      if (ok) {
        setPendingAction(prev => prev ? { ...prev, phase: 'sent' } : null);
        setToast({
          text: `成功: ${pendingAction.name}`,
          kind: 'ok',
          expiresAt: Date.now() + 1100
        });
      } else {
        setPendingAction(prev => prev ? { ...prev, phase: 'error', error } : null);
        setToast({
          text: `失败: ${error}`,
          kind: 'error',
          expiresAt: Date.now() + 4500
        });
      }
    };

    window.addEventListener('openclaw:a2ui-action-status', handleStatus);

    return () => {
      window.removeEventListener('openclaw:a2ui-action-status', handleStatus);
    };
  }, [pendingAction]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) {
      return;
    }

    const remainTime = Math.max(0, toast.expiresAt - Date.now());
    const timer = setTimeout(() => setToast(null), remainTime);

    return () => clearTimeout(timer);
  }, [toast]);

  const memoizedSetPendingAction = useCallback(setPendingAction, []);
  const memoizedSetToast = useCallback(setToast, []);

  const contextValue = useMemo(() => ({
    pendingAction,
    toast,
    setPendingAction: memoizedSetPendingAction,
    setToast: memoizedSetToast
  }), [pendingAction, toast, memoizedSetPendingAction, memoizedSetToast]);

  return (
    <A2uiActionContext.Provider value={contextValue}>
      {children}
    </A2uiActionContext.Provider>
  );
};

export const useA2uiAction = () => {
  const context = useContext(A2uiActionContext);
  if (!context) {
    throw new Error('useA2uiAction 必须在 A2uiActionProvider 内使用');
  }
  return context;
};
