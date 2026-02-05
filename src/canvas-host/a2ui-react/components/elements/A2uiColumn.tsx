/**
 * A2UI Column Component
 * Vertical layout container
 */

import React from 'react';

interface ColumnProps {
  id: string;
  children?: React.ReactNode;
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  spacing?: {
    literalNumber?: number;
  };
  scrollable?: boolean;
  style?: Record<string, unknown>;
  weight?: number;
}

export const A2uiColumn: React.FC<ColumnProps> = ({
  id,
  children,
  alignment = 'start',
  spacing,
  scrollable = false,
  style,
  weight
}) => {
  // Resolve spacing
  const gapValue = spacing?.literalNumber !== undefined
    ? `${spacing.literalNumber}px`
    : '16px';

  // Build styles
  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: alignment === 'start' ? 'flex-start' :
                 alignment === 'center' ? 'center' :
                 alignment === 'end' ? 'flex-end' : 'stretch',
    gap: gapValue,
    overflow: scrollable ? 'auto' : 'visible',
    flex: weight ? weight : undefined,
    ...style
  };

  return (
    <div id={id} className="a2ui-column" style={columnStyle}>
      {children}
    </div>
  );
};
