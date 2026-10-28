import { expect, test } from '@playwright/test';
import { ConfigError } from '@config/env';
import { buildProjects } from '@config/projects';

const names = (aut: 'conduit' | 'uat', hasPrivate: boolean) => buildProjects({ aut, hasPrivate }).map((p) => p.name);

test('conduit registers unit, setup, conduit-e2e and conduit-api', () => {
  expect(names('conduit', false)).toEqual(['unit', 'setup', 'conduit-e2e', 'conduit-api']);
});

test('conduit-e2e depends on setup', () => {
  const e2e = buildProjects({ aut: 'conduit', hasPrivate: false }).find((p) => p.name === 'conduit-e2e');
  expect(e2e?.dependencies).toEqual(['setup']);
});

test('uat without private/ fails with a clear error', () => {
  expect(() => buildProjects({ aut: 'uat', hasPrivate: false })).toThrow(ConfigError);
  expect(() => buildProjects({ aut: 'uat', hasPrivate: false })).toThrow(/private\//);
});

test('uat with private/ registers uat-e2e and uat-api', () => {
  expect(names('uat', true)).toEqual(expect.arrayContaining(['uat-e2e', 'uat-api']));
});
