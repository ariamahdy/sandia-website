import { test as base, expect, type Page } from '@playwright/test';
import { env, type Env } from '@config';

const maximize = async (page: Page): Promise<void> => {
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send('Browser.getWindowForTarget');
  await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
  await session.detach();
};

export const test = base.extend<Record<never, never>, { env: Env }>({
  page: async ({ page, headless }, use) => {
    if (!headless) await maximize(page);
    await use(page);
  },
  env: [
    async ({}, use) => {
      await use(env);
    },
    { scope: 'worker' },
  ],
});

export { expect };
