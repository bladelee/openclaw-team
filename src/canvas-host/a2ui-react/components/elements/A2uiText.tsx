/**
 * A2UI Text Component
 * Displays text with size, weight, and color options
 */

import React from 'react';
import { useA2uiMessages } from '../../context/A2uiMessageContext';

interface TextProps {
  id: string;
  text: {
    literalString?: string;
    path?: string;
  };
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
  surfaceId?: string;
  style?: Record<string, unknown>;
}

export const A2uiText: React.FC<TextProps> = ({
  id,
  text,
  size = 'medium',
  weight = 'normal',
  color,
  align = 'left',
  maxLines,
  surfaceId = 'main',
  style
}) => {
  const { resolveContextValues } = useA2uiMessages();

  // Resolve text content
  let content = '';

  if (text.path) {
    // Resolve from data model
    const resolved = resolveContextValues(
      surfaceId,
      [{ key: 'text', value: text }]
    );
    content = String(resolved.text ?? text.path ?? '');
  } else if (text.literalString !== undefined) {
    content = text.literalString;
  }

  // Size mapping
  const sizeMap: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
    xlarge: '24px'
  };

  // Weight mapping
  const weightMap: Record<string, number | string> = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  };

  // Build styles
  const textStyle: React.CSSProperties = {
    fontSize: sizeMap[size],
    fontWeight: weightMap[weight],
    color: color || '#1e293b',
    textAlign: align,
    ...style
  };

  // Handle maxLines
  if (maxLines) {
    textStyle.WebkitLineClamp = maxLines;
    textStyle.WebkitBoxOrient = 'vertical';
    textStyle.overflow = 'hidden';
    textStyle.display = '-webkit-box';
  }

  // Build className for testing
  const sizeClass = `a2ui-text-${size}`;
  const weightClass = `a2ui-text-${weight}`;

  return (
    <span
      id={id}
      className={`a2ui-text ${sizeClass} ${weightClass}`}
      style={textStyle}
    >
      {content}
    </span>
  );
};
