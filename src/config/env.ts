import { existsSync } from 'node:fs';
import { z } from 'zod';

const common = { BASE_URL: z.url(), API_URL: z.url() };
const conduitSchema = z.object({ AUT: z.literal('conduit', { error: 'expected "conduit" or "uat"' }), ...common });
const uatSchema = z.object({
  AUT: z.literal('uat'),
  ...common,
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD: z.string().min(1),
});

export type Env = z.infer<typeof conduitSchema> | z.infer<typeof uatSchema>;

export class ConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid environment:\n${issues.join('\n')}`);
    this.name = 'ConfigError';
  }
}

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = (source['AUT'] === 'uat' ? uatSchema : conduitSchema).safeParse(source);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`));
  }
  return Object.freeze(result.data);
};

export const loadEnvFile = (path: string): void => {
  if (existsSync(path)) process.loadEnvFile(path);
};
