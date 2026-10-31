import type { Project } from '@playwright/test';
import { ConfigError, type Env } from './env';

type BuildOptions = { aut: Env['AUT']; hasPrivate: boolean; mutating?: boolean };

const maximized: Project['use'] = {
  viewport: null,
  launchOptions: { args: ['--window-size=1920,1080'] },
};

const mutatingTag = /@mutating/;

const autProjects = (aut: Env['AUT'], root: string, mutating: boolean): Project[] => {
  const e2e: Project = { testDir: `${root}/e2e/${aut}`, use: { browserName: 'chromium', ...maximized } };
  return [
    { name: `${aut}-e2e`, ...e2e, grepInvert: mutatingTag },
    { name: `${aut}-api`, testDir: `${root}/api/${aut}` },
    ...(mutating ? [{ name: `${aut}-mutating`, ...e2e, grep: mutatingTag }] : []),
  ];
};

export const buildProjects = ({ aut, hasPrivate, mutating = false }: BuildOptions): readonly Project[] => {
  if (aut === 'uat' && !hasPrivate) {
    throw new ConfigError(['AUT: "uat" requires the private/ directory, which is missing']);
  }
  return [
    { name: 'unit', testDir: 'tests/unit' },
    ...(hasPrivate ? [{ name: 'uat-unit', testDir: 'private/tests/unit' }] : []),
    ...autProjects(aut, aut === 'uat' ? 'private/tests' : 'tests', mutating),
  ];
};
