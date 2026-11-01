import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e9 });

const forbidden = [
  [/(^|\/)\.env(\..+)?$/, 'env files must not be tracked'],
  [/\.zip$/, 'traces and archives must not be tracked'],
  [/(^|\/)(test-results|shared-errors|playwright-report|blob-report|\.auth)\//, 'run output must not be tracked'],
];

const problems = [];
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
for (const file of tracked) {
  if (/(^|\/)\.env\.example$/.test(file)) continue;
  const hit = forbidden.find(([pattern]) => pattern.test(file));
  if (hit) problems.push(`${file}: ${hit[1]}`);
}

const envText = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const password = /^AUTH_PASSWORD=(.*)$/m.exec(envText)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') ?? '';
let note = '';
if (password.length < 6) {
  note = ', password check skipped (no AUTH_PASSWORD of 6+ characters in .env)';
} else {
  const hasHead = (() => {
    try {
      git('rev-parse', '--verify', 'HEAD');
      return true;
    } catch {
      return false;
    }
  })();
  const unpushed = hasHead ? git('rev-list', 'HEAD', '--branches', '--not', '--remotes=origin').split('\n').filter(Boolean) : [];
  for (const sha of unpushed) {
    let file = '';
    for (const line of git('show', '--format=', '--unified=0', '--no-color', sha).split('\n')) {
      if (line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '');
      else if (line.startsWith('+') && line.includes(password)) problems.push(`${sha.slice(0, 7)} ${file}: adds the AUTH_PASSWORD value`);
    }
  }
}

if (problems.length > 0) {
  for (const problem of [...new Set(problems)]) console.error(`private-guard: ${problem}`);
  process.exit(1);
}
console.log(`private-guard: ok (${String(tracked.length)} tracked files${note})`);
