import { z } from 'zod';

// Client-side API schemas for runtime validation of server responses
// These mirror the shapes used by the frontend (subset of server shapes where relevant)

export const KeyCodeSchema = z.string().min(1, { message: 'Key code is required' });

export const CommandStepSchema = z.object({
  key_code: z.string().min(1).optional(),
  modifiers: z.array(z.string().min(1)).optional(),
  shell_command: z.string().min(1).optional(),
}).refine((v) => !!(v.key_code || v.shell_command), {
  message: 'Each command step must have key_code or shell_command',
});

export const CommandSchema = z.object({
  to: z.array(CommandStepSchema).min(1).optional(),
  description: z.string().trim().optional(),
});

export const LayerSchema = z.union([
  z.object({ type: z.literal('sublayer'), commands: z.record(KeyCodeSchema, CommandSchema) }),
  z.object({ type: z.literal('command'), command: CommandSchema }),
]);

export const ConfigSchema = z.object({
  layers: z.record(KeyCodeSchema, LayerSchema),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DataSchema = z.object({
  base: z.object({
    sublayerKeys: z.array(KeyCodeSchema),
    customKeys: z.array(z.object({ key: KeyCodeSchema })).default([]),
    fallbackKeys: z.array(KeyCodeSchema).default([]),
  }),
});
export type Data = z.infer<typeof DataSchema>;

export const AppInfoSchema = z.object({
  name: z.string().min(1),
  bundleId: z.string().optional(),
  path: z.string().optional(),
  category: z.string().optional(),
  categoryLabel: z.string().optional(),
  iconUrl: z.string().min(1).optional(),
});
export type AppInfo = z.infer<typeof AppInfoSchema>;

export const SaveConfigResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  detail: z.unknown().optional(),
});
export type SaveConfigResponse = z.infer<typeof SaveConfigResponseSchema>;

export const AppsResponseSchema = z.array(AppInfoSchema);
