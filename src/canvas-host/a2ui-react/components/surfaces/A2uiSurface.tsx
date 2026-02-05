/**
 * A2UI Surface Component
 * Renders a surface with its component tree
 */

import React, { useMemo } from 'react';
import type { Surface, A2uiComponentData } from '../../types';
import { A2uiButton } from '../elements/A2uiButton';
import { A2uiText } from '../elements/A2uiText';
import { A2uiCard } from '../elements/A2uiCard';
import { A2uiColumn } from '../elements/A2uiColumn';
import { A2uiRow } from '../elements/A2uiRow';
import { A2uiImage } from '../elements/A2uiImage';
import { A2uiTextField } from '../elements/A2uiTextField';
import { A2uiDivider } from '../elements/A2uiDivider';
import { A2uiContainer } from '../elements/A2uiContainer';
import { A2uiProgress } from '../elements/A2uiProgress';
import { A2uiModal } from '../elements/A2uiModal';
import { A2uiVideoPlayer } from '../elements/A2uiVideoPlayer';
import { A2uiAudioPlayer } from '../elements/A2uiAudioPlayer';
import { A2uiMarkdown } from '../elements/A2uiMarkdown';

interface A2uiSurfaceProps {
  surface: Surface;
}

/**
 * Component type map - maps A2UI component types to React components
 */
const COMPONENT_MAP = {
  Button: A2uiButton,
  Text: A2uiText,
  Card: A2uiCard,
  Column: A2uiColumn,
  Row: A2uiRow,
  Image: A2uiImage,
  TextField: A2uiTextField,
  Divider: A2uiDivider,
  Container: A2uiContainer,
  Progress: A2uiProgress,
  Modal: A2uiModal,
  VideoPlayer: A2uiVideoPlayer,
  AudioPlayer: A2uiAudioPlayer,
  Markdown: A2uiMarkdown
} as const;

/**
 * Render a single A2UI component
 */
function renderComponent(
  comp: A2uiComponentData,
  allComponents: Map<string, A2uiComponentData>
): React.ReactNode {
  const ComponentClass = COMPONENT_MAP[comp.type];

  if (!ComponentClass) {
    return (
      <div key={comp.id} className="a2ui-component-unknown" data-component-id={comp.id}>
        <pre>Unknown component type: {comp.type}</pre>
      </div>
    );
  }

  // Build component props from the parsed data
  const props = buildComponentProps(comp);

  // Handle children for container components (Column, Row, Card)
  const children = renderChildren(comp, allComponents);

  return (
    <ComponentClass key={comp.id} {...props}>
      {children}
    </ComponentClass>
  );
}

/**
 * Build component props from A2UI component data
 */
function buildComponentProps(comp: A2uiComponentData): Record<string, unknown> {
  const { id, props: componentProps } = comp;

  // Base props
  const baseProps: Record<string, unknown> = { id };

  // Add component-specific props
  switch (comp.type) {
    case 'Button':
      return {
        ...baseProps,
        text: (componentProps as { text?: { literalString?: string } }).text?.literalString || '',
        action: (componentProps as { action?: unknown }).action,
        disabled: (componentProps as { disabled?: boolean }).disabled || false,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Text':
      return {
        ...baseProps,
        text: (componentProps as { text?: { literalString?: string; path?: string } }).text || { literalString: '' },
        size: (componentProps as { size?: 'small' | 'medium' | 'large' | 'xlarge' }).size || 'medium',
        weight: (componentProps as { weight?: 'normal' | 'medium' | 'semibold' | 'bold' }).weight || 'normal',
        color: (componentProps as { color?: { literalString?: string } }).color?.literalString,
        usageHint: (componentProps as { usageHint?: 'title' | 'subtitle' | 'body' }).usageHint || 'body',
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Card':
      return {
        ...baseProps,
        padding: (componentProps as { padding?: { literalNumber?: number; literalString?: string } }).padding,
        backgroundColor: (componentProps as { backgroundColor?: { literalString?: string } }).backgroundColor,
        borderRadius: (componentProps as { borderRadius?: { literalNumber?: number; literalString?: string } }).borderRadius,
        children: (componentProps as { children?: { explicitList?: string[] } }).children,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Column':
      return {
        ...baseProps,
        children: (componentProps as { children?: { explicitList?: string[] } }).children,
        alignment: (componentProps as { alignment?: 'start' | 'center' | 'end' | 'stretch' }).alignment || 'start',
        spacing: (componentProps as { spacing?: { literalNumber?: number } }).spacing,
        scrollable: (componentProps as { scrollable?: boolean }).scrollable || false,
        style: (componentProps as { style?: Record<string, unknown> }).style,
        weight: comp.weight
      };

    case 'Row':
      return {
        ...baseProps,
        children: (componentProps as { children?: { explicitList?: string[] } }).children,
        alignment: (componentProps as { alignment?: 'start' | 'center' | 'end' | 'stretch' }).alignment || 'start',
        spacing: (componentProps as { spacing?: { literalNumber?: number } }).spacing,
        scrollable: (componentProps as { scrollable?: boolean }).scrollable || false,
        style: (componentProps as { style?: Record<string, unknown> }).style,
        weight: comp.weight
      };

    case 'Image':
      return {
        ...baseProps,
        url: (componentProps as { url?: { literalString: string } }).url || { literalString: '' },
        alt: (componentProps as { alt?: { literalString?: string } }).alt,
        width: (componentProps as { width?: { literalNumber?: number; literalString?: string } }).width,
        height: (componentProps as { height?: { literalNumber?: number; literalString?: string } }).height,
        fit: (componentProps as { fit?: 'cover' | 'contain' | 'fill' | 'none' }).fit || 'cover',
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'TextField':
      return {
        ...baseProps,
        label: (componentProps as { label?: { literalString?: string } }).label,
        placeholder: (componentProps as { placeholder?: { literalString?: string } }).placeholder,
        value: (componentProps as { value?: { literalString?: string; path?: string } }).value,
        disabled: (componentProps as { disabled?: boolean }).disabled || false,
        secret: (componentProps as { secret?: boolean }).secret || false,
        multiline: (componentProps as { multiline?: boolean }).multiline || false,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Divider':
      return {
        ...baseProps,
        orientation: (componentProps as { orientation?: 'horizontal' | 'vertical' }).orientation || 'horizontal',
        thickness: (componentProps as { thickness?: { literalNumber?: number } }).thickness,
        color: (componentProps as { color?: { literalString?: string } }).color,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Container':
      return {
        ...baseProps,
        padding: (componentProps as { padding?: { literalNumber?: number; literalString?: string } }).padding,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Progress':
      return {
        ...baseProps,
        value: (componentProps as { value?: { literalNumber?: number } }).value || { literalNumber: 0 },
        max: (componentProps as { max?: { literalNumber?: number } }).max,
        indeterminate: (componentProps as { indeterminate?: boolean }).indeterminate || false,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Modal':
      return {
        ...baseProps,
        title: (componentProps as { title?: { literalString?: string } }).title,
        content: (componentProps as { content?: { literalString?: string } }).content,
        dismissible: (componentProps as { dismissible?: { literalBoolean?: boolean } }).dismissible || { literalBoolean: true },
        onDismiss: (componentProps as { onDismiss?: unknown }).onDismiss,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'VideoPlayer':
      return {
        ...baseProps,
        url: (componentProps as { url?: { literalString: string } }).url || { literalString: '' },
        autoplay: (componentProps as { autoplay?: { literalBoolean?: boolean } }).autoplay || { literalBoolean: false },
        loop: (componentProps as { loop?: { literalBoolean?: boolean } }).loop || { literalBoolean: false },
        muted: (componentProps as { muted?: { literalBoolean?: boolean } }).muted || { literalBoolean: false },
        controls: (componentProps as { controls?: { literalBoolean?: boolean } }).controls || { literalBoolean: true },
        poster: (componentProps as { poster?: { literalString?: string } }).poster,
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'AudioPlayer':
      return {
        ...baseProps,
        url: (componentProps as { url?: { literalString: string } }).url || { literalString: '' },
        autoplay: (componentProps as { autoplay?: { literalBoolean?: boolean } }).autoplay || { literalBoolean: false },
        loop: (componentProps as { loop?: { literalBoolean?: boolean } }).loop || { literalBoolean: false },
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    case 'Markdown':
      return {
        ...baseProps,
        content: (componentProps as { content?: { literalString?: string } }).content || { literalString: '' },
        style: (componentProps as { style?: Record<string, unknown> }).style
      };

    default:
      return baseProps;
  }
}

/**
 * Render children for container components
 */
function renderChildren(
  comp: A2uiComponentData,
  allComponents: Map<string, A2uiComponentData>
): React.ReactNode {
  const props = comp.props;
  const childrenConfig = (props as { children?: { explicitList?: string[] } }).children;

  if (!childrenConfig?.explicitList) {
    return null;
  }

  return childrenConfig.explicitList.map((childId) => {
    const childComp = allComponents.get(childId);
    if (!childComp) {
      return (
        <div key={childId} className="a2ui-component-missing" data-component-id={childId}>
          Missing component: {childId}
        </div>
      );
    }
    return renderComponent(childComp, allComponents);
  });
}

export const A2uiSurface: React.FC<A2uiSurfaceProps> = ({ surface }) => {
  const { components, rootComponentId } = surface;

  // Build component tree
  const componentTree = useMemo(() => {
    if (!rootComponentId) {
      return (
        <div className="a2ui-surface-no-root">
          No root component specified
        </div>
      );
    }

    const rootComponent = components.get(rootComponentId);
    if (!rootComponent) {
      return (
        <div className="a2ui-surface-root-missing">
          Root component not found: {rootComponentId}
        </div>
      );
    }

    return renderComponent(rootComponent, components);
  }, [components, rootComponentId]);

  return (
    <div className="a2ui-surface" data-surface-id={surface.id}>
      {componentTree}
    </div>
  );
};
