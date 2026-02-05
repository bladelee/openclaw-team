/**
 * A2UI Button Component
 * Interactive button with action support
 */

import React, { useCallback } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import { useA2uiAction } from '../../context/A2uiActionContext';
import { useA2uiMessages } from '../../context/A2uiMessageContext';
import { getActionId } from '../../utils/uuid';
import { getBridgeAdapter } from '../../services/bridgeAdapter';
import './A2uiButton.module.css';

interface ButtonProps {
  id: string;
  text: string;
  action?: {
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
  disabled?: boolean;
  style?: Record<string, unknown>;
  weight?: number;
}

export const A2uiButton: React.FC<ButtonProps> = ({
  id,
  text,
  action,
  disabled = false,
  style,
  weight
}) => {
  const { theme, platform } = useA2uiTheme();
  const { setPendingAction, setToast } = useA2uiAction();
  const { resolveContextValues } = useA2uiMessages();

  // Merge styles (theme + platform + custom)
  const buttonStyle = {
    ...theme.components.Button,
    ...style,
    boxShadow: platform === 'android'
      ? theme.platform.android.shadow
      : theme.platform.ios.shadow
  };

  // Handle click
  const handleClick = useCallback(async () => {
    if (disabled || !action) {
      return;
    }

    const actionId = getActionId();
    setPendingAction({
      id: actionId,
      name: action.name,
      phase: 'sending',
      startedAt: Date.now()
    });

    // Resolve context values (with path support)
    const context = resolveContextValues(action.surfaceId, action.context);

    const userAction = {
      id: actionId,
      name: action.name,
      surfaceId: action.surfaceId,
      sourceComponentId: id,
      timestamp: new Date().toISOString(),
      context
    };

    const bridge = getBridgeAdapter();
    const result = await bridge.postMessage(userAction);

    if (result.ok) {
      setPendingAction({
        id: actionId,
        name: action.name,
        phase: 'sent',
        startedAt: Date.now()
      });
      setToast({
        text: `成功: ${action.name}`,
        kind: 'ok',
        expiresAt: Date.now() + 1100
      });
    } else {
      setPendingAction({
        id: actionId,
        name: action.name,
        phase: 'error',
        error: result.error,
        startedAt: Date.now()
      });
      setToast({
        text: `失败: ${result.error}`,
        kind: 'error',
        expiresAt: Date.now() + 4500
      });
    }
  }, [disabled, action, id, setPendingAction, setToast]);

  // Handle touch (prevent 300ms delay)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleClick();
  }, [handleClick]);

  return (
    <button
      id={id}
      className={`a2ui-button ${platform}`}
      style={{ ...buttonStyle, flex: weight ? weight : undefined }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      disabled={disabled}
    >
      {text}
    </button>
  );
};
