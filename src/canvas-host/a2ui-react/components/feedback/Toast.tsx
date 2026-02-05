/**
 * Toast Component
 * Lightweight notification message
 */

import React, { useEffect, useMemo } from 'react';
import type { Toast } from '../../types';
import './Toast.module.css';

interface ToastProps {
  toast: Toast;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { text, kind } = toast;

  // Calculate remaining time
  const remainingTime = useMemo(() => {
    return Math.max(0, toast.expiresAt - Date.now());
  }, [toast.expiresAt]);

  useEffect(() => {
    // Auto-dismiss handled by context
  }, []);

  const className = `a2ui-toast a2ui-toast-${kind}`;

  return (
    <div className={className} style={{ animationDuration: `${remainingTime}ms` }}>
      {text}
    </div>
  );
};

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */
interface ToastContainerProps {
  toasts: Toast[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="a2ui-toast-container">
      {toasts.map((toast, index) => (
        <Toast key={`${toast.expiresAt}-${index}`} toast={toast} />
      ))}
    </div>
  );
};
