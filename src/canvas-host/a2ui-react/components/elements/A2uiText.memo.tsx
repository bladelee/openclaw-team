/**
 * A2uiText Component (Performance Optimized)
 * Text display component with size and weight options
 */

import React, { useMemo } from 'react';
import { useA2uiMessages } from '../../context/A2uiMessageContext';
import type { A2uiTextProps } from '../../types';
import styles from './A2uiText.module.css';

export const A2uiText = React.memo<A2uiTextProps>(({
  id,
  text,
  size = 'medium',
  weight = 'normal',
  color,
  align = 'left',
  maxLines,
  surfaceId = 'main'
}) => {
  const { resolveContextValues } = useA2uiMessages();

  // Resolve text content (path or literal)
  const textContent = useMemo(() => {
    if (!text) {
      return '';
    }

    if ('path' in text && text.path) {
      const resolved = resolveContextValues(surfaceId, [{ key: 'text', value: text }]);
      return String(resolved.text ?? '');
    }

    if ('literalString' in text) {
      return text.literalString;
    }

    return '';
  }, [text, surfaceId, resolveContextValues]);

  // Build className
  const className = useMemo(() => {
    const classes = [
      styles.text,
      styles[size],
      styles[weight],
      styles[align]
    ];

    return classes.join(' ');
  }, [size, weight, align]);

  // Build inline styles
  const inlineStyle = useMemo(() => {
    const style: React.CSSProperties = {};

    if (color) {
      style.color = color;
    }

    if (maxLines) {
      style.WebkitLineClamp = maxLines;
      style.WebkitBoxOrient = 'vertical';
      style.overflow = 'hidden';
      style.display = '-webkit-box';
    }

    return style;
  }, [color, maxLines]);

  return <span id={id} className={className} style={inlineStyle}>{textContent}</span>;
});

A2uiText.displayName = 'A2uiText';

export default A2uiText;
