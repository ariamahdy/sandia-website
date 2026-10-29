import type { BrowserContext, Page } from '@playwright/test';

export type SessionSnapshot = { readonly url: string; readonly entries: Readonly<Record<string, string>> };

export const captureSessionStorage = async (page: Page): Promise<SessionSnapshot> => ({
  url: page.url(),
  entries: await page.evaluate(() => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key !== null) entries[key] = sessionStorage.getItem(key) ?? '';
    }
    return entries;
  }),
});

export const restoreSessionStorage = async (context: BrowserContext, snapshot: SessionSnapshot): Promise<void> => {
  await context.addInitScript(
    ({ origin, entries }) => {
      if ((globalThis as unknown as { location: { origin: string } }).location.origin !== origin) return;
      for (const [key, value] of Object.entries(entries)) {
        if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
      }
    },
    { origin: new URL(snapshot.url).origin, entries: snapshot.entries },
  );
};
