import { z } from 'zod';
import type {
  Command,
  AppCommand,
  WindowCommand,
  RaycastCommand,
  ShellCommand,
  KeyPressCommand,
  KeyBinding,
  Layer,
  Config,
  HistoryEntry,
  AppState,
} from './types';

// Version
export const SchemaVersionSchema = z.literal<'1'>('1');

// Primitives
export const KeyCodeSchema = z.string().min(1);
export const KeyboardLayoutSchema = z.enum(['ansi', 'iso']);

// Command discriminated union
export const AppCommandSchema = z.object({
  type: z.literal('app'),
  appName: z.string().min(1),
}) satisfies z.ZodType<AppCommand>;

export const WindowActionSchema = z.union([
  z.enum([
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'top-center-two-thirds',
    'top-center-sixth',
    'bottom-center-sixth',
    'smaller',
    'larger',
    'move-up',
  ]),
  // Allow custom actions for extensibility
  z.string().min(1),
]);

export const WindowCommandSchema = z.object({
  type: z.literal('window'),
  action: WindowActionSchema,
}) satisfies z.ZodType<WindowCommand>;

export const RaycastCommandSchema = z.object({
  type: z.literal('raycast'),
  deeplink: z.string().url().or(z.string().min(1)), // be permissive: allow custom deeplink schemes
  ignore: z.boolean().optional(),
}) satisfies z.ZodType<RaycastCommand>;

export const ShellCommandSchema = z.object({
  type: z.literal('shell'),
  command: z.string().min(1),
}) satisfies z.ZodType<ShellCommand>;

export const KeyPressCommandSchema = z.object({
  type: z.literal('key'),
  to: z.object({
    key_code: z.string().min(1),
    modifiers: z.array(z.string().min(1)).optional(),
  }),
}) satisfies z.ZodType<KeyPressCommand>;

export const CommandSchema = z.discriminatedUnion('type', [
  AppCommandSchema,
  WindowCommandSchema,
  RaycastCommandSchema,
  ShellCommandSchema,
  KeyPressCommandSchema,
]) satisfies z.ZodType<Command>;

// Key binding
export const KeyBindingSchema = z.object({
  key: KeyCodeSchema,
  command: CommandSchema,
}) satisfies z.ZodType<KeyBinding>;

// Layer
export const SublayerSchema = z.object({
  type: z.literal('sublayer'),
  commands: z.record(KeyCodeSchema, CommandSchema),
});

export const SingleCommandLayerSchema = z.object({
  type: z.literal('command'),
  command: CommandSchema,
});

export const LayerSchema = z.union([SublayerSchema, SingleCommandLayerSchema]) satisfies z.ZodType<Layer>;

// Config with version
export const ConfigSchema = z.object({
  version: SchemaVersionSchema,
  layers: z.record(KeyCodeSchema, LayerSchema),
}) satisfies z.ZodType<Config>;

// History and AppState
export const HistoryEntrySchema = z.object({
  id: z.string().min(1), // uuid preferred but allow any non-empty id
  timestamp: z.number().int().nonnegative(),
  action: z.string().min(1),
  payload: z.unknown().optional(),
}) satisfies z.ZodType<HistoryEntry>;

export const AppStateSchema = z.object({
  version: SchemaVersionSchema,
  currentLayerKey: KeyCodeSchema.nullable(),
  locks: z.record(KeyCodeSchema, z.boolean()),
  keyboardLayout: KeyboardLayoutSchema,
  history: z.array(HistoryEntrySchema),
}) satisfies z.ZodType<AppState>;

// Parse helpers
export function parseConfig(input: unknown): Config {
  return ConfigSchema.parse(input);
}

export function parseAppState(input: unknown): AppState {
  return AppStateSchema.parse(input);
}

// Simple self-test utility for acceptance validation
export function runSchemaSelfTest() {
  const validConfig: Config = {
    version: '1',
    layers: {
      a: { type: 'sublayer', commands: { s: { type: 'app', appName: 'Safari' } } },
      b: { type: 'command', command: { type: 'shell', command: "echo 'hi'" } },
    },
  };
  const invalidConfig = {
    version: '2', // wrong version
    layers: {
      x: { type: 'sublayer', commands: { y: { type: 'unknown', foo: 'bar' } } },
    },
  } as unknown;

  const validAppState: AppState = {
    version: '1',
    currentLayerKey: 'a',
    locks: { a: true },
    keyboardLayout: 'ansi',
    history: [
      { id: '1', timestamp: Date.now(), action: 'init' },
    ],
  };
  const invalidAppState = {
    version: '1',
    currentLayerKey: 123, // wrong type
    locks: {},
    keyboardLayout: 'dvorak', // wrong enum
    history: [],
  } as unknown;

  const results: Array<{ name: string; ok: boolean; error?: string }> = [];
  try {
    parseConfig(validConfig);
    results.push({ name: 'config:valid', ok: true });
  } catch (e) {
    results.push({ name: 'config:valid', ok: false, error: (e as Error).message });
  }
  try {
    parseConfig(invalidConfig);
    results.push({ name: 'config:invalid', ok: false, error: 'should have failed' });
  } catch {
    results.push({ name: 'config:invalid', ok: true });
  }
  try {
    parseAppState(validAppState);
    results.push({ name: 'appState:valid', ok: true });
  } catch (e) {
    results.push({ name: 'appState:valid', ok: false, error: (e as Error).message });
  }
  try {
    parseAppState(invalidAppState);
    results.push({ name: 'appState:invalid', ok: false, error: 'should have failed' });
  } catch {
    results.push({ name: 'appState:invalid', ok: true });
  }

  const ok = results.every(r => r.ok);
  return { ok, results };
}
