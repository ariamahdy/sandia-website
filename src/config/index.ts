import { loadEnv } from './env';

export { ConfigError, envFileFor, loadEnv, loadEnvFile } from './env';
export type { Env } from './env';
export const env = loadEnv();
