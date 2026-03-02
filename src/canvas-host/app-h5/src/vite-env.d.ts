/**
 * Vite Environment Variable Type Declarations
 */

interface ImportMetaEnv {
  readonly VITE_AUTH_CENTER_URL: string;
  readonly VITE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
