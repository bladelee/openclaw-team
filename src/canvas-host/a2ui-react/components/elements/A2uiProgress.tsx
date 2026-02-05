/**
 * A2UI Progress Component
 * Progress bar (determinate or indeterminate)
 */

import React from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import './A2uiProgress.module.css';

interface ProgressProps {
  id: string;
  value: {
    literalNumber?: number;
  };
  max?: {
    literalNumber?: number;
  };
  indeterminate?: boolean;
  style?: Record<string, unknown>;
}

export const A2uiProgress: React.FC<ProgressProps> = ({
  id,
  value,
  max,
  indeterminate = false,
  style
}) => {
  const { theme } = useA2uiTheme();

  // Resolve value and max
  const valueNumber = value?.literalNumber ?? 0;
  const maxNumber = max?.literalNumber ?? 100;

  // Calculate percentage
  const percentage = indeterminate ? 0 : Math.min(100, Math.max(0, (valueNumber / maxNumber) * 100));

  // Build styles
  const progressStyle: React.CSSProperties = {
    ...style
  };

  const barStyle: React.CSSProperties = {
    width: indeterminate ? '100%' : `${percentage}%`,
    backgroundColor: theme.colors.primary
  };

  return (
    <div id={id} className="a2ui-progress" style={progressStyle}>
      <div
        className={`a2ui-progress-bar ${indeterminate ? 'a2ui-progress-indeterminate' : ''}`}
        style={barStyle}
      />
    </div>
  );
};
