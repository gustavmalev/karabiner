// Shared TypeScript types for the Visualizer server

export interface AppBase {
  name: string;
  path: string;
}

export interface AppInfo extends AppBase {
  bundleId?: string;
  category?: string;
  categoryLabel?: string;
  iconUrl: string;
}

export type ModifierKey =
  | 'left_shift'
  | 'left_command'
  | 'left_control'
  | 'left_option'
  | 'right_shift'
  | 'right_command'
  | 'right_control'
  | 'right_option';

export interface Action {
  key_code?: string;
  modifiers?: ModifierKey[];
  shell_command?: string;
  set_variable?: { name: string; value: number };
  set_notification_message?: { text: string };
}

export interface CommandAction {
  to: Action[];
  description?: string;
}

export interface CommandDef {
  type: 'command';
  command: CommandAction;
}

export interface SublayerDef {
  type: 'sublayer';
  commands: Record<string, CommandAction>;
}

export type LayerDef = CommandDef | SublayerDef;

export interface RulesConfig {
  layers: Record<string, LayerDef>;
}

// Analysis API shapes
export interface AnalyzedBase {
  sublayerKeys: string[];
  customKeys: Array<{ key: string; description?: string; detail: unknown }>;
  fallbackKeys: string[];
}

export interface AnalyzedResult {
  base: AnalyzedBase;
  layers: Record<string, { title?: string; commands: Array<{ key: string; description?: string; detail: unknown }> }>;
  stats: {
    totalBaseCustom: number;
    totalBaseFallback: number;
    totalSublayers: number;
    seenBaseKeys: string[];
  };
}
