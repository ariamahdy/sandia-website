import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const gitFiles = (...args) =>
  execFileSync('git', ['ls-files', '-z', ...args], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);

const denylistFiles = ['scripts/guard.denylist.txt', 'private/guard.denylist.txt'];
const patterns = denylistFiles
  .map((file) => join(root, file))
  .filter((path) => existsSync(path))
  .flatMap((path) => readFileSync(path, 'utf8').split('\n'))
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => new RegExp(line, 'i'));

const problems = [];

for (const file of gitFiles('--', 'private')) {
  problems.push(`${file}: private/ must never be tracked`);
}

const tracked = gitFiles();

for (const file of tracked) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example')) {
    problems.push(`${file}: env files other than .env.example must never be tracked`);
  }
}

for (const file of tracked) {
  const path = join(root, file);
  if (denylistFiles.includes(file) || !existsSync(path) || !lstatSync(path).isFile()) continue;
  const content = readFileSync(path);
  if (content.includes(0)) continue;
  content
    .toString('utf8')
    .split('\n')
    .forEach((line, index) => {
      const hit = patterns.find((pattern) => pattern.test(line));
      if (hit) problems.push(`${file}:${String(index + 1)}: matches denylist pattern /${hit.source}/`);
    });
}

for (const file of tracked.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))) {
  readFileSync(join(root, file), 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const ref = /^\s*-?\s*uses:\s*(\S+)/.exec(line)?.[1];
      if (ref === undefined || ref.startsWith('./') || ref.startsWith('docker://') || /@[0-9a-f]{40}$/.test(ref)) return;
      problems.push(`${file}:${String(index + 1)}: action ${ref} is not pinned to a commit SHA`);
    });
}

const hasHead = (() => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const git = (...args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
const unpushed = hasHead ? git('rev-list', 'HEAD', '--branches', '--not', '--remotes').split('\n').filter(Boolean) : [];

for (const sha of unpushed) {
  let file = '';
  let previous = '';
  const hits = new Set();
  for (const line of git('show', '--format=', '--diff-merges=first-parent', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/', sha).split('\n')) {
    const header = line.startsWith('+++ ') && previous.startsWith('--- ');
    previous = line;
    if (header) {
      file = line.startsWith('+++ b/') ? line.slice(6) : '';
      continue;
    }
    if (!line.startsWith('+') || file === '' || denylistFiles.includes(file)) continue;
    const hit = patterns.find((pattern) => pattern.test(line.slice(1)));
    if (hit) hits.add(`${sha.slice(0, 7)} ${file}: matches denylist pattern /${hit.source}/`);
  }
  problems.push(...hits);
}

if (problems.length > 0) {
  console.error(`guard: ${String(problems.length)} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`guard: ok (${String(tracked.length)} tracked files, ${String(patterns.length)} denylist patterns)`);
