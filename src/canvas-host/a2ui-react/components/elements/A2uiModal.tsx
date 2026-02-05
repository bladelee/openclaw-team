/**
 * A2UI Modal Component
 * Modal overlay with content
 */

import React, { useEffect, useCallback } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import './A2uiModal.module.css';

interface ModalProps {
  id: string;
  title?: {
    literalString?: string;
  };
  content?: {
    literalString?: string;
  };
  dismissible?: {
    literalBoolean?: boolean;
  };
  style?: Record<string, unknown>;
  onDismiss?: {
    name: string;
    surfaceId: string;
    context?: Array<{
      key: string;
      value:
        | { literalString: string }
        | { literalNumber: number }
        | { literalBoolean: boolean }
        | { path: string };
    }>;
  };
}

export const A2uiModal: React.FC<ModalProps> = ({
  id,
  title,
  content,
  dismissible = { literalBoolean: true },
  style,
  onDismiss
}) => {
  const { theme } = useA2uiTheme();

  const isDismissible = dismissible?.literalBoolean !== false;

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDismissible && onDismiss) {
      // Trigger dismiss action
      console.log('[A2UI Modal] Dismiss via Escape key');
    }
  }, [isDismissible, onDismiss]);

  useEffect(() => {
    if (isDismissible) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isDismissible, handleEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleBackdropClick = useCallback(() => {
    if (isDismissible && onDismiss) {
      console.log('[A2UI Modal] Dismiss via backdrop click');
    }
  }, [isDismissible, onDismiss]);

  const titleText = title?.literalString;
  const contentText = content?.literalString;

  return (
    <div
      id={id}
      className="a2ui-modal-overlay"
      onClick={handleBackdropClick}
    >
      <div
        className="a2ui-modal-content"
        style={{ backgroundColor: theme.colors.surface, ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        {titleText && (
          <div className="a2ui-modal-header">
            <h3 className="a2ui-modal-title">{titleText}</h3>
          </div>
        )}
        {contentText && (
          <div className="a2ui-modal-body">
            <p className="a2ui-modal-text">{contentText}</p>
          </div>
        )}
      </div>
    </div>
  );
};
