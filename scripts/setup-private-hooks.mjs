import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const privateRepo = join(import.meta.dirname, '..', 'private');

if (existsSync(join(privateRepo, '.git'))) {
  execFileSync('git', ['-C', privateRepo, 'config', 'core.hooksPath', '../scripts/private-hooks']);
  console.log('private hooks: core.hooksPath set');
} else {
  console.log('private hooks: no private/ repo, skipped');
}
