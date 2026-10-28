import { test as base, expect } from '@playwright/test';
import { env, type Env } from '@config';

export const test = base.extend<Record<never, never>, { env: Env }>({
  env: [
    async ({}, use) => {
      await use(env);
    },
    { scope: 'worker' },
  ],
});

export { expect };
