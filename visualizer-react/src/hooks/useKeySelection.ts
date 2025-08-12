import {useMemo} from 'react';

type CmdModalState =
  | { mode: 'edit'; cmdKey: string }
  | { mode: 'add'; prefill: string };

export function useKeySelection(params: {
  rows: string[][];
  baseKey?: string | null;
  sublayerCommands?: Record<string, unknown>;
  setShowCmdModal: (v: CmdModalState) => void;
}) {
  const {rows, baseKey, sublayerCommands, setShowCmdModal} = params;

  const keyHandlers = useMemo(() => {
    const map: Record<string, (() => void) | undefined> = {};
    const baseLower = baseKey?.toLowerCase();
    const existingMap = (sublayerCommands || {}) as Record<string, unknown>;
    for (const code of rows.flat()) {
      const lower = code.toLowerCase();
      const isBase = baseLower === lower;
      if (isBase) {
        map[lower] = undefined;
      } else if (existingMap[lower]) {
        map[lower] = () => setShowCmdModal({ mode: 'edit', cmdKey: lower });
      } else {
        map[lower] = () => setShowCmdModal({ mode: 'add', prefill: lower });
      }
    }
    return map;
  }, [rows, sublayerCommands, baseKey, setShowCmdModal]);

  return { keyHandlers } as const;
}
