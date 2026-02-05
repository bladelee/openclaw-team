/**
 * A2uiCard Component (Performance Optimized)
 * Container component with padding and background
 */

import React, { useMemo } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import type { A2uiCardProps } from '../../types';
import styles from './A2uiCard.module.css';

export const A2uiCard = React.memo<A2uiCardProps>(({
  id,
  children,
  padding,
  backgroundColor,
  borderRadius,
  shadow = true
}) => {
  const { theme } = useA2uiTheme();

  // Build className
  const className = useMemo(() => {
    const classes = [styles.card];

    if (shadow) {
      classes.push(styles.withShadow);
    }

    return classes.join(' ');
  }, [shadow]);

  // Build inline styles
  const inlineStyle = useMemo(() => {
    const style: React.CSSProperties = {};

    if (padding !== undefined) {
      style.padding = `${padding}px`;
    } else {
      style.padding = theme.components.Card.padding;
    }

    if (backgroundColor) {
      style.backgroundColor = backgroundColor;
    } else {
      style.backgroundColor = theme.components.Card.backgroundColor;
    }

    if (borderRadius !== undefined) {
      style.borderRadius = `${borderRadius}px`;
    } else {
      style.borderRadius = theme.components.Card.borderRadius;
    }

    return style;
  }, [padding, backgroundColor, borderRadius, theme]);

  return (
    <div id={id} className={className} style={inlineStyle}>
      {children}
    </div>
  );
});

A2uiCard.displayName = 'A2uiCard';

export default A2uiCard;
