import { z } from 'zod';
import type { Command, Config, Layer } from '../types';

// Persisted schema version. Increment when making breaking changes to persisted shape.
export const SCHEMA_VERSION = 2 as const;

// Zod schemas mirroring our runtime types
export const zKeyCode = z.string();

const zCommandToStep = z.object({
  key_code: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  shell_command: z.string().optional(),
});

export const zCommand: z.ZodType<Command> = z.object({
  to: z.array(zCommandToStep).optional(),
  description: z.string().optional(),
});

const zLayerSublayer = z.object({
  type: z.literal('sublayer'),
  commands: z.record(zKeyCode, zCommand),
});
const zLayerCommand = z.object({
  type: z.literal('command'),
  command: zCommand,
});

export const zLayer: z.ZodType<Layer> = z.union([zLayerSublayer, zLayerCommand]);

export const zConfig: z.ZodType<Config> = z.object({
  layers: z.record(zKeyCode, zLayer),
});

export const zFilter = z.enum(['all', 'available', 'sublayer', 'custom', 'thirdparty']);
export const zKeyboardLayout = z.enum(['ansi', 'iso']);

export const zPersisted = z.object({
  schemaVersion: z.number().int().nonnegative(),
  config: zConfig,
  locks: z.record(zKeyCode, z.boolean()).default({}),
  filter: zFilter,
  keyboardLayout: zKeyboardLayout,
  aiKey: z.string().default(''),
  blockedKeys: z.record(zKeyCode, z.boolean()).default({}),
  // Present on exported artifacts
  exportedAt: z.string().datetime().optional(),
});

export type Persisted = z.infer<typeof zPersisted>;
