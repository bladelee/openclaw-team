/**
 * A2UI Divider Component
 * Horizontal/vertical separator line
 */

import React from 'react';

interface DividerProps {
  id: string;
  orientation?: 'horizontal' | 'vertical';
  thickness?: {
    literalNumber?: number;
  };
  color?: {
    literalString?: string;
  };
  style?: Record<string, unknown>;
}

export const A2uiDivider: React.FC<DividerProps> = ({
  id,
  orientation = 'horizontal',
  thickness,
  color,
  style
}) => {
  // Resolve thickness
  const thicknessValue = thickness?.literalNumber !== undefined
    ? `${thickness.literalNumber}px`
    : '1px';

  // Resolve color
  const colorValue = color?.literalString || 'rgba(255, 255, 255, 0.1)';

  // Build styles
  const dividerStyle: React.CSSProperties = {
    border: 'none',
    borderTop: orientation === 'horizontal' ? thicknessValue : 'none',
    borderLeft: orientation === 'vertical' ? thicknessValue : 'none',
    borderColor: colorValue,
    ...style
  };

  return (
    <div
      id={id}
      className={`a2ui-divider a2ui-divider-${orientation}`}
      style={dividerStyle}
    />
  );
};
