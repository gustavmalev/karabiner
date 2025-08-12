/**
 * Security utilities: input sanitization and validation for commands.
 *
 * - Sanitizes user text to prevent XSS injection in UI contexts
 * - Validates Raycast deeplinks
 * - Whitelists allowed shell commands and blocks dangerous patterns
 */

export type ValidationResult = { valid: true } | { valid: false; reason: string };

const TAG_RE = /<[^>]*>/g; // remove any HTML tags
const CONTROL_RE = /[\u0000-\u001F\u007F]/g; // control chars

/** Sanitize generic user-provided text for safe rendering and storage. */
export function sanitizeText(input: string): string {
  const s = String(input ?? '');
  return s.replace(TAG_RE, '').replace(CONTROL_RE, '');
}

/** Validate Raycast deeplink format. */
export function validateRaycastDeeplink(link: string): ValidationResult {
  const v = String(link || '').trim();
  if (!/^raycast:\/\//.test(v)) return { valid: false, reason: 'Must start with raycast://'};
  try {
    const u = new URL(v);
    if (u.protocol !== 'raycast:') return { valid: false, reason: 'Invalid protocol' };
    if (!u.hostname) return { valid: false, reason: 'Missing extension or path' };
  } catch {
    return { valid: false, reason: 'Malformed deeplink' };
  }
  return { valid: true };
}

// Allowed shell command prefixes. Keep conservative.
const SHELL_WHITELIST_PREFIXES = [
  'open ',
  'open -a ',
  'open -g ',
];

// Dangerous patterns to block outright
const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\b\s+-rf\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bsudo\b/i,
  /\bmkfs\b/i,
  /\b:>\b/, // truncate 
  /\b>|\b2>\b|\b>>\b/, // redirects
  /\|\s*sh\b|\|\s*bash\b/i,
  /;\s*\w+/, // command chaining
];

/**
 * Validate a shell command against a safe whitelist and block dangerous patterns.
 */
export function validateShellCommand(cmd: string): ValidationResult {
  const v = sanitizeText(cmd).trim();
  if (!v) return { valid: false, reason: 'Empty command' };
  const allowed = SHELL_WHITELIST_PREFIXES.some((p) => v.startsWith(p));
  if (!allowed) return { valid: false, reason: 'Command must start with an allowed prefix (open, open -a, open -g)' };
  for (const re of DANGEROUS_SHELL_PATTERNS) {
    if (re.test(v)) return { valid: false, reason: 'Command contains dangerous pattern' };
  }
  return { valid: true };
}

/** Normalize a Raycast deeplink to canonical format. */
export function normalizeRaycast(link: string): string {
  const v = String(link || '').trim();
  return v.startsWith('raycast://') ? v : `raycast://${v}`;
}

/** Normalize safe app name for open -a. */
export function normalizeAppName(name: string): string {
  const s = sanitizeText(name).trim();
  return s.replace(/["'`]/g, '');
}
