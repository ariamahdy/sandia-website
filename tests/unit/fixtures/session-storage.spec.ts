import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { captureSessionStorage, clearRestoredSessionStorage, restoreSessionStorage } from '@fixtures/session-storage';

const appUrl = 'https://app.test/home';

const serve = async (context: BrowserContext): Promise<void> => {
  await context.route(/^https:\/\/(app|other)\.test\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>app</body></html>' }),
  );
};

const storageOf = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key !== null) out[key] = sessionStorage.getItem(key) ?? '';
    }
    return out;
  });

test('captures the page url and its session storage', async ({ page }) => {
  await serve(page.context());
  await page.goto(appUrl);
  expect(await captureSessionStorage(page)).toEqual({ url: appUrl, entries: {} });

  await page.evaluate(() => {
    sessionStorage.setItem('a', '1');
    sessionStorage.setItem('b', 'x"y\nz');
  });
  expect(await captureSessionStorage(page)).toEqual({ url: appUrl, entries: { a: '1', b: 'x"y\nz' } });
});

test('restores the entries on the same origin in a new context', async ({ browser }) => {
  const snapshot = { url: appUrl, entries: { a: '1', b: 'x"y\nz' } };
  const context = await browser.newContext();
  await serve(context);
  await restoreSessionStorage(context, snapshot);
  const page = await context.newPage();
  await page.goto(snapshot.url);
  expect((await captureSessionStorage(page)).entries).toEqual(snapshot.entries);
  await context.close();
});

test('does not write the entries on another origin', async ({ browser }) => {
  const context = await browser.newContext();
  await serve(context);
  await restoreSessionStorage(context, { url: appUrl, entries: { a: '1' } });
  const page = await context.newPage();
  await page.goto('https://other.test/');
  expect(await storageOf(page)).toEqual({});
  await context.close();
});

test('keeps a value the app changed after load', async ({ browser }) => {
  const context = await browser.newContext();
  await serve(context);
  await restoreSessionStorage(context, { url: appUrl, entries: { a: '1' } });
  const page = await context.newPage();
  await page.goto(appUrl);
  await page.evaluate(() => {
    sessionStorage.setItem('a', '2');
  });
  await page.reload();
  expect((await captureSessionStorage(page)).entries).toEqual({ a: '2' });
  await context.close();
});

test('does not refill the entries after the restored storage was cleared', async ({ browser }) => {
  const context = await browser.newContext();
  await serve(context);
  await restoreSessionStorage(context, { url: appUrl, entries: { a: '1' } });
  const page = await context.newPage();
  await page.goto(appUrl);
  await clearRestoredSessionStorage(page);
  await page.reload();
  expect(await captureSessionStorage(page)).toEqual({ url: appUrl, entries: {} });
  await context.close();
});

test('captures only the app entries after a restore', async ({ browser }) => {
  const context = await browser.newContext();
  await serve(context);
  await restoreSessionStorage(context, { url: appUrl, entries: { a: '1' } });
  const page = await context.newPage();
  await page.goto(appUrl);
  expect(await captureSessionStorage(page)).toEqual({ url: appUrl, entries: { a: '1' } });
  await context.close();
});

test('refuses a snapshot from an opaque origin', async ({ browser }) => {
  const context = await browser.newContext();
  await expect(restoreSessionStorage(context, { url: 'about:blank', entries: { a: '1' } })).rejects.toThrow(/opaque origin/);
  await context.close();
});
