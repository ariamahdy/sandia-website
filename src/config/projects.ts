import type { Project } from '@playwright/test';
import { ConfigError, type Env } from './env';

type BuildOptions = { aut: Env['AUT']; hasPrivate: boolean };

const autProjects = (aut: Env['AUT'], root: string): Project[] => [
  { name: 'setup', testDir: `${root}/setup`, testMatch: '**/*.setup.ts' },
  {
    name: `${aut}-e2e`,
    testDir: `${root}/e2e/${aut}`,
    dependencies: ['setup'],
    use: { browserName: 'chromium', storageState: `.auth/${aut}.json` },
  },
  { name: `${aut}-api`, testDir: `${root}/api/${aut}` },
];

export const buildProjects = ({ aut, hasPrivate }: BuildOptions): readonly Project[] => {
  if (aut === 'uat' && !hasPrivate) {
    throw new ConfigError(['AUT: "uat" requires the private/ directory, which is missing']);
  }
  return [{ name: 'unit', testDir: 'tests/unit' }, ...autProjects(aut, aut === 'uat' ? 'private/tests' : 'tests')];
};
