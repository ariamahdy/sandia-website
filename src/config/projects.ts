import type { Project } from '@playwright/test';
import { ConfigError, type Env } from './env';

type BuildOptions = { aut: Env['AUT']; hasPrivate: boolean };

const maximized: Project['use'] = {
  viewport: null,
  launchOptions: { args: ['--window-size=1920,1080'] },
};

const autProjects = (aut: Env['AUT'], root: string): Project[] => [
  { name: `${aut}-e2e`, testDir: `${root}/e2e/${aut}`, use: { browserName: 'chromium', ...maximized } },
  { name: `${aut}-api`, testDir: `${root}/api/${aut}` },
];

export const buildProjects = ({ aut, hasPrivate }: BuildOptions): readonly Project[] => {
  if (aut === 'uat' && !hasPrivate) {
    throw new ConfigError(['AUT: "uat" requires the private/ directory, which is missing']);
  }
  return [{ name: 'unit', testDir: 'tests/unit' }, ...autProjects(aut, aut === 'uat' ? 'private/tests' : 'tests')];
};
