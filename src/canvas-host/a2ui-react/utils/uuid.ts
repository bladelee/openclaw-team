/**
 * UUID Generator
 * Compatible with older systems that don't support crypto.randomUUID()
 */

/**
 * Generate a unique action ID
 * Falls back to timestamp + random for older systems
 */
export function getActionId(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random + anti-duplicate
  return `a2ui_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.floor(Math.random() * 10000)}`;
}
