/**
 * A2uiButton Component (Performance Optimized)
 * Interactive button component with action handling
 */

import React, { useCallback, useMemo } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import { useA2uiAction } from '../../context/A2uiActionContext';
import { getActionId } from '../../utils/uuid';
import { getBridgeAdapter } from '../../services/bridgeAdapter';
import type { A2uiButtonProps } from '../../types';
import styles from './A2uiButton.module.css';

export const A2uiButton = React.memo<A2uiButtonProps>(({
  id,
  text = '',
  action,
  style,
  disabled = false,
  isLoading = false
}) => {
  const { theme, platform } = useA2uiTheme();
  const { setPendingAction } = useA2uiAction();

  // Merge styles (theme + platform + custom)
  const buttonStyle = useMemo(() => ({
    ...theme.components.Button,
    ...style,
    boxShadow: platform === 'android'
      ? theme.platform.android.shadow
      : theme.platform.ios.shadow
  }), [theme, platform, style]);

  // Handle click with memoized callback
  const handleClick = useCallback(async () => {
    if (disabled || isLoading || !action) {
      return;
    }

    const actionId = getActionId();
    setPendingAction({
      id: actionId,
      name: action.name,
      phase: 'sending',
      startedAt: Date.now()
    });

    const userAction = {
      id: actionId,
      name: action.name,
      surfaceId: action.surfaceId || 'main',
      sourceComponentId: id,
      timestamp: new Date().toISOString(),
      context: action.context || {}
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
    } else {
      setPendingAction({
        id: actionId,
        name: action.name,
        phase: 'error',
        error: result.error,
        startedAt: Date.now()
      });
    }
  }, [disabled, isLoading, action, id, setPendingAction]);

  // Handle touch (prevent 300ms delay)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    void handleClick();
  }, [handleClick]);

  const className = useMemo(() => {
    const classes = [styles.button, platform];
    if (isLoading) {
      classes.push(styles.loading);
    }
    return classes.join(' ');
  }, [isLoading, platform]);

  return (
    <button
      id={id}
      className={className}
      style={buttonStyle}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      disabled={disabled || isLoading}
    >
      {isLoading && <span className={styles.spinner} />}
      <span className={styles.text}>{text}</span>
    </button>
  );
});

A2uiButton.displayName = 'A2uiButton';

export default A2uiButton;
