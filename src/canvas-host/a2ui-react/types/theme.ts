/**
 * Theme Type Definitions
 */

/** A2UI theme configuration */
export interface A2uiTheme {
  colors: ThemeColors;
  platform: PlatformStyles;
  components: ComponentStyles;
  cssVars: Record<string, string>;
}

/** Theme colors */
export interface ThemeColors {
  primary: string;
  primaryAndroid?: string;
  primaryIOS?: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  statusOk: string;
  statusError: string;
  statusWarning: string;
}

/** Platform-specific styles */
export interface PlatformStyles {
  android: PlatformStyle;
  ios: PlatformStyle;
}

export interface PlatformStyle {
  shadow: string;
  blur: string;
}

/** Component styles */
export interface ComponentStyles {
  Button: ButtonStyles;
  Card: CardStyles;
  Text: TextStyles;
  TextField: TextFieldStyles;
}

/** Button styles */
export interface ButtonStyles {
  padding: string;
  borderRadius: string;
  fontSize: string;
  fontWeight: string;
  backgroundColor?: string;
}

/** Card styles */
export interface CardStyles {
  padding: string;
  borderRadius: string;
  backgroundColor: string;
}

/** Text styles */
export interface TextStyles {
  small: { fontSize: string };
  medium: { fontSize: string };
  large: { fontSize: string };
  xlarge: { fontSize: string };
}

/** TextField styles */
export interface TextFieldStyles {
  padding: string;
  borderRadius: string;
  backgroundColor: string;
  fontSize: string;
}

/** Toast notification */
export interface Toast {
  text: string;
  kind: 'ok' | 'error' | 'warning';
  expiresAt: number;
}

/** Platform type */
export type Platform = 'ios' | 'android' | 'unknown';

/** Theme mode */
export type ThemeMode = 'light' | 'dark' | 'auto';
