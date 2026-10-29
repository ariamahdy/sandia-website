import { existsSync } from 'node:fs';
import { defineConfig, type ReporterDescription } from '@playwright/test';
import { envFileFor, loadEnv, loadEnvFile } from '@config/env';
import { buildProjects } from '@config/projects';

loadEnvFile(envFileFor());
const env = loadEnv();
const ci = Boolean(process.env.CI);
const mutating = process.env.npm_lifecycle_event === 'test:uat:mutating';
const reporter: ReporterDescription[] = [['list'], ['html', { open: 'never' }]];

export default defineConfig({
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [...reporter, ['junit', { outputFile: 'test-results/junit.xml' }]] : reporter,
  expect: { timeout: 5_000 },
  use: {
    baseURL: env.BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [...buildProjects({ aut: env.AUT, hasPrivate: existsSync('private'), mutating })],
});
