// Core domain types for the visualizer config/state (strict, shared)

export type SchemaVersion = '1';
export const SCHEMA_VERSION: SchemaVersion = '1';

export type KeyCode = string;

export type CmdType = 'app' | 'window' | 'raycast' | 'shell' | 'key';

// Discriminated union for domain-level commands (editor intent)
export type AppCommand = {
  type: 'app';
  appName: string; // e.g., 'Safari'
};

export type WindowCommand = {
  type: 'window';
  action:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center-two-thirds'
    | 'top-center-sixth'
    | 'bottom-center-sixth'
    | 'smaller'
    | 'larger'
    | 'move-up'
    | string; // allow custom actions for extensibility
};

export type RaycastCommand = {
  type: 'raycast';
  deeplink: string; // e.g., "raycast://extensions/..."
  ignore?: boolean | undefined; // whether to ignore in some contexts
};

export type ShellCommand = {
  type: 'shell';
  command: string; // arbitrary shell command
};

export type KeyPressCommand = {
  type: 'key';
  to: { key_code: string; modifiers?: string[] | undefined };
};

export type Command =
  | AppCommand
  | WindowCommand
  | RaycastCommand
  | ShellCommand
  | KeyPressCommand;

// A binding of one inner key to a command, used within sublayers
export interface KeyBinding {
  key: KeyCode;
  command: Command;
}

// Layer model used by the editor and persisted config
export type Layer =
  | { type: 'sublayer'; commands: Record<KeyCode, Command> }
  | { type: 'command'; command: Command };

// Config persisted to disk (with versioning)
export interface Config {
  version: SchemaVersion;
  layers: Record<KeyCode, Layer>;
}

// History used for simple undo/audit trail
export interface HistoryEntry {
  id: string; // uuid
  timestamp: number; // ms since epoch
  action: string; // e.g., 'add-command', 'delete-layer'
  payload?: unknown;
}

// Persisted editor state (separate from live runtime UI state)
export type KeyboardLayout = 'ansi' | 'iso';

export interface AppState {
  version: SchemaVersion;
  currentLayerKey: KeyCode | null;
  locks: Record<KeyCode, boolean>;
  keyboardLayout: KeyboardLayout;
  history: HistoryEntry[];
}
