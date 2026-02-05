/**
 * Spinner Component
 * Loading indicator
 */

import React from 'react';
import './Spinner.module.css';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'medium', color }) => {
  const sizeClass = `a2ui-spinner-${size}`;

  return (
    <div className={`a2ui-spinner ${sizeClass}`} style={color ? { color } : undefined}>
      <svg className="a2ui-spinner-svg" viewBox="0 0 50 50">
        <circle
          className="a2ui-spinner-circle"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="5"
        />
      </svg>
    </div>
  );
};
