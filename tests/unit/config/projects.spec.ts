import { expect, test } from '@playwright/test';
import { ConfigError } from '@config/env';
import { buildProjects } from '@config/projects';

const names = (aut: 'conduit' | 'uat', hasPrivate: boolean) => buildProjects({ aut, hasPrivate }).map((p) => p.name);

test('conduit registers unit, conduit-e2e and conduit-api', () => {
  expect(names('conduit', false)).toEqual(['unit', 'conduit-e2e', 'conduit-api']);
});

test('conduit-e2e runs in chromium', () => {
  const e2e = buildProjects({ aut: 'conduit', hasPrivate: false }).find((p) => p.name === 'conduit-e2e');
  expect(e2e?.use).toMatchObject({ browserName: 'chromium' });
});

test('uat without private/ fails with a clear error', () => {
  expect(() => buildProjects({ aut: 'uat', hasPrivate: false })).toThrow(ConfigError);
  expect(() => buildProjects({ aut: 'uat', hasPrivate: false })).toThrow(/private\//);
});

test('uat with private/ registers uat-e2e and uat-api', () => {
  expect(names('uat', true)).toEqual(expect.arrayContaining(['uat-e2e', 'uat-api']));
});

test('e2e projects open the browser maximized', () => {
  for (const aut of ['conduit', 'uat'] as const) {
    const e2e = buildProjects({ aut, hasPrivate: true }).find((p) => p.name === `${aut}-e2e`);
    expect(e2e?.use).toMatchObject({
      viewport: null,
      launchOptions: { args: ['--start-maximized', '--window-size=1920,1080'] },
    });
  }
});
