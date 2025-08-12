import {useCallback, useMemo, useState} from 'react';
import {useStore} from '../state/store';
import {numberRow, topRow, homeRow, bottomRow, labelForKey} from '../utils/keys';
import type {CmdType} from './useCommandForm';

export function useAISuggestions() {
  const apps = useStore((s) => s.apps);
  const aiKey = useStore((s) => s.aiKey);
  const setAIKey = useStore((s) => s.setAIKey);

  const hasAIKey = !!aiKey;
  const [apiKeyInput, setApiKeyInput] = useState<string>(aiKey || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedKey, setSuggestedKey] = useState<string>('');
  const [rationale, setRationale] = useState<string>('');

  const allKeyCodes = useMemo(() => [
    ...numberRow,
    ...topRow,
    ...homeRow,
    ...bottomRow,
  ], []);

  const suggestInnerKey = useCallback((params: { type: CmdType; text: string; takenInnerKeys: string[] }) => {
    const { type, text, takenInnerKeys } = params;
    const available = allKeyCodes
      .map((c) => c.toLowerCase())
      .filter((c) => !takenInnerKeys.includes(c));
    const isLetter = (c: string) => /^[a-z]$/.test(c);
    const availableLetters = available.filter(isLetter);

    const comfortOrder = [
      ...homeRow,
      ...topRow,
      ...bottomRow,
    ].map((c) => c.toLowerCase());
    const comfortOrderLetters = Array.from(new Set(comfortOrder.filter(isLetter)));
    const comfortRank = (c: string) => {
      const i = comfortOrderLetters.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    let sourceLabel = (text || '').trim();
    if (type === 'raycast') {
      try {
        const raw = sourceLabel.replace(/^"|"$/g, '');
        const last = raw.split('/').filter(Boolean).pop() || raw;
        sourceLabel = last.replace(/[?#].*$/, '');
      } catch {}
    }
    const slug = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const stop = new Set(['the','a','an','of','and','for','to','in','on','with','by','at']);
    const words = slug.split(/\s+/).filter((w) => w && !stop.has(w));
    const initials = Array.from(new Set(words.map((w) => w.charAt(0)).filter((ch) => /[a-z]/.test(ch))));
    const others: string[] = [];
    for (const w of words) {
      for (const ch of w.slice(1)) if (/[a-z]/.test(ch)) others.push(ch);
    }
    const uniqueOthers = Array.from(new Set(others));

    const categoryLetters: string[] = [];
    if (type === 'app') {
      const match = apps.find(a => a.name.toLowerCase() === sourceLabel.toLowerCase());
      const uti = (match as any)?.category || '';
      const tail = uti.split('.').pop() || '';
      const tokens = tail.split('-').filter(Boolean);
      for (const t of tokens) {
        const ch = t.charAt(0);
        if (/[a-z]/.test(ch)) categoryLetters.push(ch);
      }
    }
    const mnemonicCandidates = [...categoryLetters, ...initials, ...uniqueOthers];

    const mnemonicAvailable = mnemonicCandidates.filter((ch) => availableLetters.includes(ch));
    if (mnemonicAvailable.length) {
      const head = mnemonicAvailable[0]!;
      const rest = mnemonicAvailable.slice(1);
      const choice = rest.reduce((best, ch) => (comfortRank(ch) < comfortRank(best) ? ch : best), head);
      const isCat = categoryLetters.includes(choice);
      const isInitial = initials.includes(choice);
      const whyInitial = isCat ? 'category letter' : (isInitial ? 'first letter' : 'mnemonic letter');
      const first = initials[0] ?? '';
      const pre = first && choice !== first && !availableLetters.includes(first)
        ? `First letter ${first.toUpperCase()} is taken; `
        : '';
      const rowHint = comfortRank(choice) <= comfortRank('a') ? ' on a comfortable row' : '';
      return { key: choice, reason: `${pre}Picked ${choice.toUpperCase()} — ${whyInitial} from “${sourceLabel}”${rowHint}.` };
    }

    const categoryInitial: Record<CmdType, string> = { app: 'a', window: 'w', raycast: 'r', shell: 's', key: 'k' };
    const cat = categoryInitial[type];
    if (type !== 'app' && cat && availableLetters.includes(cat)) {
      return { key: cat, reason: `No mnemonic letters free; picked category letter ${cat.toUpperCase()} for ${type}.` };
    }

    if (availableLetters.length) {
      const head = availableLetters[0]!;
      const rest = availableLetters.slice(1);
      const choice = rest.reduce((best, ch) => (comfortRank(ch) < comfortRank(best) ? ch : best), head);
      return { key: choice, reason: `No mnemonic or category letter free; picked comfortable letter ${choice.toUpperCase()}.` };
    }

    const nonLetterPreferred = [
      ...homeRow,
      ...topRow,
      ...bottomRow,
      ...numberRow,
    ].map((c) => c.toLowerCase()).filter((c) => !isLetter(c));
    const anyNonLetter = nonLetterPreferred.find((c) => available.includes(c)) || available[0];
    if (anyNonLetter) {
      return { key: anyNonLetter, reason: `No letters available — picked free key ${labelForKey(anyNonLetter)}.` };
    }
    return { key: null, reason: 'No free keys available in this sublayer.' };
  }, [allKeyCodes, apps]);

  const runSuggestion = useCallback((params: { type: CmdType; text: string; takenInnerKeys: string[] }) => {
    setIsSuggesting(true);
    try {
      const {key, reason} = suggestInnerKey(params);
      setSuggestedKey(key || '');
      setRationale(reason || '');
      return {key, reason};
    } finally {
      setIsSuggesting(false);
    }
  }, [suggestInnerKey]);

  return {
    hasAIKey,
    apiKeyInput, setApiKeyInput,
    showApiKeyModal, setShowApiKeyModal,
    setAIKey,
    isSuggesting,
    suggestedKey, setSuggestedKey,
    rationale, setRationale,
    runSuggestion,
  } as const;
}
