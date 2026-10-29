import type { BrowserContext, Page } from '@playwright/test';

export type SessionSnapshot = { readonly url: string; readonly entries: Readonly<Record<string, string>> };

const marker = '__pw_session_restored';

export const captureSessionStorage = async (page: Page): Promise<SessionSnapshot> => ({
  url: page.url(),
  entries: await page.evaluate((skip) => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key !== null && key !== skip) entries[key] = sessionStorage.getItem(key) ?? '';
    }
    return entries;
  }, marker),
});

export const restoreSessionStorage = async (context: BrowserContext, snapshot: SessionSnapshot): Promise<void> => {
  await context.addInitScript(
    ({ origin, entries, done }) => {
      if ((globalThis as unknown as { location: { origin: string } }).location.origin !== origin) return;
      if (sessionStorage.getItem(done) !== null) return;
      for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value);
      sessionStorage.setItem(done, '1');
    },
    { origin: new URL(snapshot.url).origin, entries: snapshot.entries, done: marker },
  );
};

export const clearRestoredSessionStorage = async (page: Page): Promise<void> => {
  await page.evaluate((done) => {
    sessionStorage.clear();
    sessionStorage.setItem(done, '1');
  }, marker);
};
