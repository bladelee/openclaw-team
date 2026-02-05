/**
 * A2UI Container Component
 * Simple container with optional padding
 */

import React from 'react';

interface ContainerProps {
  id: string;
  padding?: {
    literalNumber?: number;
    literalString?: string;
  };
  children?: {
    explicitList?: string[];
  };
  style?: Record<string, unknown>;
}

export const A2uiContainer: React.FC<ContainerProps> = ({
  id,
  padding,
  children,
  style
}) => {
  // Resolve padding
  let paddingValue: string | undefined;
  if (padding?.literalNumber !== undefined) {
    paddingValue = `${padding.literalNumber}px`;
  } else if (padding?.literalString) {
    paddingValue = padding.literalString;
  }

  // Build styles
  const containerStyle: React.CSSProperties = {
    padding: paddingValue,
    ...style
  };

  return (
    <div id={id} className="a2ui-container" style={containerStyle}>
      {children && 'Children rendering handled by A2uiSurface'}
    </div>
  );
};
