/**
 * A2UI React H5 Server Integration
 * Serves the React-based A2UI H5 application
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectMime } from "../../media/mime.js";

export const A2UI_REACT_PATH = "/__openclaw__/a2ui/react";

let cachedReactRootReal: string | null | undefined;
let resolvingReactRoot: Promise<string | null> | null = null;

/**
 * Resolve the A2UI React build directory
 */
async function resolveReactRoot(): Promise<string | null> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Production build (after running pnpm a2ui:react:build)
    path.resolve(here, "../../../dist/a2ui-react"),
    // Running from source with dev server (after running pnpm a2ui:react:dev)
    path.resolve(process.cwd(), "dist/a2ui-react"),
    // Fallback to repo root during development
    path.resolve(process.cwd(), "src/canvas-host/a2ui-react/dist"),
  ];

  for (const dir of candidates) {
    try {
      const indexPath = path.join(dir, "index.html");
      await fs.stat(indexPath);
      return dir;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Get cached React root path
 */
async function resolveReactRootReal(): Promise<string | null> {
  if (cachedReactRootReal !== undefined) {
    return cachedReactRootReal;
  }
  if (!resolvingReactRoot) {
    resolvingReactRoot = (async () => {
      const root = await resolveReactRoot();
      cachedReactRootReal = root ? await fs.realpath(root) : null;
      return cachedReactRootReal;
    })();
  }
  return resolvingReactRoot;
}

/**
 * Normalize URL path for security
 */
function normalizeUrlPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath || "/");
  const normalized = path.posix.normalize(decoded);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

/**
 * Resolve file path within React root with security checks
 */
async function resolveReactFilePath(rootReal: string, urlPath: string) {
  const normalized = normalizeUrlPath(urlPath);
  const rel = normalized.replace(/^\/+/, "");
  if (rel.split("/").some((p) => p === "..")) {
    return null;
  }

  let candidate = path.join(rootReal, rel);
  if (normalized.endsWith("/")) {
    candidate = path.join(candidate, "index.html");
  }

  try {
    const st = await fs.stat(candidate);
    if (st.isDirectory()) {
      candidate = path.join(candidate, "index.html");
    }
  } catch {
    // ignore
  }

  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  try {
    const lstat = await fs.lstat(candidate);
    if (lstat.isSymbolicLink()) {
      return null;
    }
    const real = await fs.realpath(candidate);
    if (!real.startsWith(rootPrefix)) {
      return null;
    }
    return real;
  } catch {
    return null;
  }
}

/**
 * Inject A2UI bridge helpers into HTML
 * This is similar to the existing injectCanvasLiveReload but without WebSocket
 */
function injectA2uiBridge(html: string): string {
  const snippet = `
<script>
(() => {
  // Cross-platform action bridge helper for A2UI React
  // Works on:
  // - iOS: window.webkit.messageHandlers.openclawCanvasA2UIAction.postMessage(...)
  // - Android: window.openclawCanvasA2UIAction.postMessage(...)
  // - Pure H5: falls back to backend API
  const handlerNames = ["openclawCanvasA2UIAction"];
  function postToNode(payload) {
    try {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const name of handlerNames) {
        const iosHandler = globalThis.webkit?.messageHandlers?.[name];
        if (iosHandler && typeof iosHandler.postMessage === "function") {
          iosHandler.postMessage(raw);
          return true;
        }
        const androidHandler = globalThis[name];
        if (androidHandler && typeof androidHandler.postMessage === "function") {
          androidHandler.postMessage(raw);
          return true;
        }
      }
    } catch {}
    return false;
  }

  function sendUserAction(userAction) {
    const id =
      (userAction && typeof userAction.id === "string" && userAction.id.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const action = { ...userAction, id };
    return postToNode({ userAction: action });
  }

  // Global API for A2UI React
  globalThis.OpenClaw = globalThis.OpenClaw || {};
  globalThis.OpenClaw.postMessage = postToNode;
  globalThis.OpenClaw.sendUserAction = sendUserAction;

  // A2UI React specific API
  globalThis.openclawA2UI = {
    applyMessages: async function(messages) {
      // This will be handled by the React app internally
      if (globalThis.openclawA2UIInternal && typeof globalThis.openclawA2UIInternal.applyMessages === 'function') {
        return await globalThis.openclawA2UIInternal.applyMessages(messages);
      }
      return { ok: false, error: 'A2UI React not initialized' };
    },
    reset: async function() {
      if (globalThis.openclawA2UIInternal && typeof globalThis.openclawA2UIInternal.reset === 'function') {
        return await globalThis.openclawA2UIInternal.reset();
      }
      return { ok: false, error: 'A2UI React not initialized' };
    },
    getSurfaces: function() {
      if (globalThis.openclawA2UIInternal && typeof globalThis.openclawA2UIInternal.getSurfaces === 'function') {
        return globalThis.openclawA2UIInternal.getSurfaces();
      }
      return [];
    }
  };
})();
</script>
`.trim();

  const idx = html.toLowerCase().lastIndexOf("</head>");
  if (idx >= 0) {
    return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
  }
  return `${html}\n${snippet}`;
}

/**
 * Handle A2UI React H5 HTTP requests
 */
export async function handleA2uiReactHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath =
    url.pathname === A2UI_REACT_PATH || url.pathname.startsWith(`${A2UI_REACT_PATH}/`)
      ? A2UI_REACT_PATH
      : undefined;

  if (!basePath) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const reactRootReal = await resolveReactRootReal();
  if (!reactRootReal) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html>
<meta charset="utf-8" />
<title>A2UI React Not Found</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #071016; color: #fff; }
  .card { max-width: 500px; padding: 24px; background: #0f1720; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
  h1 { margin: 0 0 16px; font-size: 20px; }
  code { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 14px; }
</style>
<div class="card">
  <h1>A2UI React Build Not Found</h1>
  <p>Please run <code>pnpm a2ui:react:build</code> to build the React app, or <code>pnpm a2ui:react:dev</code> to start the dev server.</p>
</div>`,
    );
    return true;
  }

  const rel = url.pathname.slice(basePath.length);
  const filePath = await resolveReactFilePath(reactRootReal, rel || "/");

  if (!filePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("not found");
    return true;
  }

  const lower = filePath.toLowerCase();
  const mime =
    lower.endsWith(".html") || lower.endsWith(".htm")
      ? "text/html"
      : ((await detectMime({ filePath })) ?? "application/octet-stream");

  res.setHeader("Cache-Control", "no-store");

  if (mime === "text/html") {
    const html = await fs.readFile(filePath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(injectA2uiBridge(html));
    return true;
  }

  res.setHeader("Content-Type", mime);
  res.end(await fs.readFile(filePath));
  return true;
}

/**
 * Clear cached React root path (useful for testing)
 */
export function clearA2uiReactCache(): void {
  cachedReactRootReal = undefined;
  resolvingReactRoot = null;
}
