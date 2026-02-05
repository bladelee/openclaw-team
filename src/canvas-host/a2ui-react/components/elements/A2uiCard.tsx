/**
 * A2UI Card Component
 * Container with padding and background
 */

import React from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';

interface CardProps {
  id: string;
  children?: React.ReactNode;
  padding?: {
    literalNumber?: number;
    literalString?: string;
  };
  backgroundColor?: {
    literalString?: string;
  };
  borderRadius?: {
    literalNumber?: number;
    literalString?: string;
  };
  style?: Record<string, unknown>;
}

export const A2uiCard: React.FC<CardProps> = ({
  id,
  children,
  padding,
  backgroundColor,
  borderRadius,
  style
}) => {
  const { theme } = useA2uiTheme();

  // Resolve padding
  let paddingValue = theme.components.Card.padding;
  if (padding?.literalNumber !== undefined) {
    paddingValue = `${padding.literalNumber}px`;
  } else if (padding?.literalString) {
    paddingValue = padding.literalString;
  }

  // Resolve background color
  const bgColor = backgroundColor?.literalString || theme.components.Card.backgroundColor;

  // Resolve border radius
  let radiusValue = theme.components.Card.borderRadius;
  if (borderRadius?.literalNumber !== undefined) {
    radiusValue = `${borderRadius.literalNumber}px`;
  } else if (borderRadius?.literalString) {
    radiusValue = borderRadius.literalString;
  }

  // Build styles
  const cardStyle: React.CSSProperties = {
    padding: paddingValue,
    backgroundColor: bgColor,
    borderRadius: radiusValue,
    ...style
  };

  return (
    <div id={id} className="a2ui-card" style={cardStyle}>
      {children}
    </div>
  );
};
