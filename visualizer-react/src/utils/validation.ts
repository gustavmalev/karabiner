import { ZodError, type ZodSchema } from 'zod';

export class ValidationError extends Error {
  issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export function formatZodError(error: ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join('.') || '(root)';
    return `${path}: ${i.message}`;
  });
}

export async function parseJsonResponse<T>(r: Response, schema: ZodSchema<T>, context: string): Promise<T> {
  if (!r.ok) {
    throw new Error(`${context} failed: ${r.url} ${r.status}`);
  }
  let data: unknown;
  try {
    data = await r.json();
  } catch (e) {
    throw new Error(`${context} failed: invalid JSON`);
  }
  try {
    return schema.parse(data);
  } catch (e) {
    const issues = e instanceof ZodError ? formatZodError(e) : [String(e)];
    throw new ValidationError(`${context} response validation failed`, issues);
  }
}

export function assertValid<T>(schema: ZodSchema<T>, input: unknown, context: string): T {
  try {
    return schema.parse(input);
  } catch (e) {
    const issues = e instanceof ZodError ? formatZodError(e) : [String(e)];
    throw new ValidationError(`${context} validation failed`, issues);
  }
}
