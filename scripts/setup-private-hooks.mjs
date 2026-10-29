import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const privateRepo = join(root, 'private');

if (existsSync(join(privateRepo, '.git'))) {
  execFileSync('git', ['-C', privateRepo, 'config', 'core.hooksPath', '../scripts/private-hooks']);
  console.log('private hooks: core.hooksPath set');
} else {
  console.log('private hooks: no private/ repo, skipped');
}
