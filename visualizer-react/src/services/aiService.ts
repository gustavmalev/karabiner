import type { CmdType } from '../hooks/useCommandForm';
import type { StoreState } from '../state/types';

export type SuggestionContext = {
  recentTypes: Partial<Record<CmdType, number>>;
  appNames: string[];
};

/** Analyze store to extract simple usage patterns for context-aware suggestions. */
export function analyzeContext(s: Pick<StoreState, 'history' | 'snapshots' | 'apps'>): SuggestionContext {
  const counts: Partial<Record<CmdType, number>> = { app: 0, window: 0, raycast: 0, shell: 0, key: 0 };
  const appNames = (s.apps || []).map((a) => a.name.toLowerCase());
  return { recentTypes: counts, appNames };
}

/** Rank letters based on simple context (e.g., prefer 'a' if many app actions recently). */
/** Rank candidate letters using lightweight contextual weighting. */
export function rankLettersByContext(letters: string[], ctx: SuggestionContext, type: CmdType): string[] {
  const weights = new Map<string, number>();
  const base = 1;
  for (const ch of letters) weights.set(ch, base);
  // Boost based on type
  const typeBoost: Record<CmdType, string[]> = {
    app: ['a'], window: ['w'], raycast: ['r'], shell: ['s'], key: ['k'],
  };
  for (const ch of typeBoost[type] || []) weights.set(ch, (weights.get(ch) || base) + 1.5);
  // Additional boost if this type has recent usage
  const recent = Math.min(5, Math.max(0, (ctx.recentTypes[type] || 0)));
  for (const ch of typeBoost[type] || []) weights.set(ch, (weights.get(ch) || base) + recent * 0.1);
  // Sort by weight desc
  return [...letters].sort((a, b) => (weights.get(b)! - weights.get(a)!));
}
