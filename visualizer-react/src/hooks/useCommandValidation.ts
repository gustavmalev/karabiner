import { useMemo } from 'react';
import { sanitizeText, validateRaycastDeeplink, validateShellCommand, normalizeRaycast, normalizeAppName } from '../utils/security';
import type { CmdType } from './useCommandForm';

export type CommandInput = { type: CmdType; text: string; ignore?: boolean };
export type CommandValidation = {
  sanitizedText: string;
  isValid: boolean;
  reason?: string;
  normalized?: string;
};

/** Real-time validation for command inputs with security checks. */
export function useCommandValidation(input: CommandInput): CommandValidation {
  const { type, text, ignore } = input;

  return useMemo<CommandValidation>(() => {
    const t = sanitizeText(text || '');
    if (!t.trim()) return { sanitizedText: '', isValid: false, reason: 'Required' };

    if (type === 'raycast') {
      const deeplink = normalizeRaycast(t);
      const ok = validateRaycastDeeplink(deeplink);
      return ok.valid ? { sanitizedText: t, isValid: true, normalized: deeplink } : { sanitizedText: t, isValid: false, reason: ok.reason };
    }
    if (type === 'shell') {
      const ok = validateShellCommand(t);
      return ok.valid ? { sanitizedText: t, isValid: true } : { sanitizedText: t, isValid: false, reason: ok.reason };
    }
    if (type === 'app') {
      const name = normalizeAppName(t);
      return name ? { sanitizedText: name, isValid: true, normalized: name } : { sanitizedText: '', isValid: false, reason: 'Invalid app name' };
    }
    // window/raycast handled above; key commands handled by capture step
    return { sanitizedText: t, isValid: true };
  }, [type, text, ignore]);
}
