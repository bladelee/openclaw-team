/**
 * A2UI Type Definitions
 * Based on A2UI v0.8 specification from vendor/a2ui/specification/0.8/
 */

/** A2UI component types from standard catalog */
export type A2uiComponentType =
  | 'AudioPlayer'
  | 'Button'
  | 'Card'
  | 'Column'
  | 'Container'
  | 'Divider'
  | 'Image'
  | 'Markdown'
  | 'Modal'
  | 'Progress'
  | 'Row'
  | 'Text'
  | 'TextField'
  | 'VideoPlayer';

/** A2UI message - one action per message */
export type A2uiMessage =
  | { beginRendering: A2uiBeginRendering }
  | { surfaceUpdate: A2uiSurfaceUpdate }
  | { dataModelUpdate: A2uiDataModelUpdate }
  | { deleteSurface: A2uiDeleteSurface };

/** Begin rendering action */
export interface A2uiBeginRendering {
  surfaceId: string;
  catalogId?: string;
  root: string;
  styles?: Record<string, unknown>;
}

/** Surface update action */
export interface A2uiSurfaceUpdate {
  surfaceId: string;
  components: A2uiComponent[];
}

/** Data model update action */
export interface A2uiDataModelUpdate {
  surfaceId: string;
  path?: string;
  contents: A2uiDataEntry[];
}

/** Delete surface action */
export interface A2uiDeleteSurface {
  surfaceId: string;
}

/** A2UI component */
export interface A2uiComponent {
  id: string;
  weight?: number;
  component: Record<A2uiComponentType, unknown>;
}

/** A2UI data entry */
export interface A2uiDataEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueObject?: Record<string, unknown>;
  valueArray?: unknown[];
  valueNull?: null;
}

/** Component action definition */
export interface ComponentAction {
  name: string;
  surfaceId: string;
  context?: ComponentContextValue[];
}

/** Component context value (static or dynamic) */
export type ComponentContextValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { path: string };

/** Surface data structure */
export interface Surface {
  id: string;
  components: Map<string, A2uiComponentData>;
  dataModel: DataModel;
  rootComponentId?: string;
}

/** Extended component data with parsed type */
export interface A2uiComponentData {
  id: string;
  type: A2uiComponentType;
  props: Record<string, unknown>;
  weight?: number;
  action?: ComponentAction;
}

/** Data model */
export type DataModel = Record<string, unknown>;

/** Button component props */
export interface ButtonProps {
  text: string;
  action?: ComponentAction;
  disabled?: boolean;
  style?: Record<string, unknown>;
}

/** Text component props */
export interface TextProps {
  content: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
}

/** Card component props */
export interface CardProps {
  padding?: string;
  backgroundColor?: string;
  borderRadius?: string;
  children?: A2uiComponent[];
}

/** Column component props */
export interface ColumnProps {
  children?: A2uiComponent[];
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  spacing?: number;
  scrollable?: boolean;
}

/** Row component props */
export interface RowProps {
  children?: A2uiComponent[];
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  spacing?: number;
  scrollable?: boolean;
}

/** Image component props */
export interface ImageProps {
  url: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
}

/** TextField component props */
export interface TextFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  secret?: boolean;
  multiline?: boolean;
}

/** Progress component props */
export interface ProgressProps {
  value: number;
  max?: number;
  indeterminate?: boolean;
}
