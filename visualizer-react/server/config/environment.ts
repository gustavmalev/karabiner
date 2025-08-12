import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5178),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ICON_MEM_LRU_MAX_ENTRIES: z.coerce.number().int().positive().default(512),
  ICON_MEM_LRU_MAX_MB: z.coerce.number().int().positive().default(64),
  ICON_DISK_CACHE_MAX_MB: z.coerce.number().int().positive().default(100),
});

const parsed = EnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  LOG_LEVEL: process.env.LOG_LEVEL,
  ICON_MEM_LRU_MAX_ENTRIES: process.env.ICON_MEM_LRU_MAX_ENTRIES,
  ICON_MEM_LRU_MAX_MB: process.env.ICON_MEM_LRU_MAX_MB,
  ICON_DISK_CACHE_MAX_MB: process.env.ICON_DISK_CACHE_MAX_MB,
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const ENV = {
  ...parsed.data,
  get DEV() { return parsed.data.NODE_ENV !== 'production'; },
  get PROD() { return parsed.data.NODE_ENV === 'production'; },
};

export type Env = typeof ENV;
