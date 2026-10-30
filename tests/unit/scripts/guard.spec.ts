import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const guard = resolve('scripts/guard.mjs');
const isolatedConfig = join(mkdtempSync(join(tmpdir(), 'guard-config-')), 'gitconfig');
writeFileSync(isolatedConfig, '');
const env = { ...process.env, GIT_CONFIG_GLOBAL: isolatedConfig, GIT_CONFIG_NOSYSTEM: '1' };

type Repo = { dir: string; git: (...args: string[]) => string; write: (path: string, text: string) => void };

const makeRepo = (): Repo => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  const dir = join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', join(root, 'remote.git')], { env });
  execFileSync('git', ['init', '-q', '-b', 'main', dir], { env });
  const git = (...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.test', ...args], { cwd: dir, encoding: 'utf8', env });
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  git('remote', 'add', 'origin', join(root, 'remote.git'));
  write('scripts/guard.denylist.txt', '\\bforbiddenterm\\b\n');
  write('README.md', 'clean\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  git('push', '-q', 'origin', 'main');
  return { dir, git, write };
};

const runGuard = (repo: Repo) => {
  const result = spawnSync('node', [guard], { cwd: repo.dir, encoding: 'utf8', env });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

const addAndRemove = (repo: Repo): string => {
  repo.write('notes.md', 'has forbiddenterm here\n');
  repo.git('add', 'notes.md');
  repo.git('commit', '-q', '-m', 'add');
  const sha = repo.git('rev-parse', '--short=7', 'HEAD').trim();
  repo.write('notes.md', 'clean again\n');
  repo.git('commit', '-q', '-am', 'remove');
  return sha;
};

test('fails on a term added and removed in unpushed commits', () => {
  const repo = makeRepo();
  const sha = addAndRemove(repo);
  const { status, output } = runGuard(repo);
  expect(status).toBe(1);
  expect(output).toContain(`${sha} notes.md: matches denylist pattern /\\bforbiddenterm\\b/`);
  expect(output).not.toContain('has forbiddenterm here');
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('ignores a term that is only in pushed commits', () => {
  const repo = makeRepo();
  addAndRemove(repo);
  repo.git('push', '-q', 'origin', 'main');
  expect(runGuard(repo).status).toBe(0);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('passes a clean unpushed commit', () => {
  const repo = makeRepo();
  repo.write('notes.md', 'clean\n');
  repo.git('add', 'notes.md');
  repo.git('commit', '-q', '-m', 'clean');
  expect(runGuard(repo).status).toBe(0);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

const commitWorkflow = (repo: Repo, uses: string): void => {
  repo.write('.github/workflows/ci.yml', `jobs:\n  a:\n    steps:\n      - uses: ${uses}\n`);
  repo.git('add', '.github/workflows/ci.yml');
  repo.git('commit', '-q', '-m', 'workflow');
  repo.git('push', '-q', 'origin', 'main');
};

test('fails on an action pinned by tag', () => {
  const repo = makeRepo();
  commitWorkflow(repo, 'actions/checkout@v7.0.1');
  const { status, output } = runGuard(repo);
  expect(status).toBe(1);
  expect(output).toContain('.github/workflows/ci.yml:4: action actions/checkout@v7.0.1 is not pinned to a commit SHA');
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('passes an action pinned by a 40-character SHA', () => {
  const repo = makeRepo();
  commitWorkflow(repo, `actions/checkout@${'a'.repeat(40)} # v7.0.1`);
  expect(runGuard(repo).status).toBe(0);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('passes local and docker actions', () => {
  const repo = makeRepo();
  commitWorkflow(repo, './local-action');
  repo.write('.github/workflows/two.yml', 'jobs:\n  a:\n    steps:\n      - uses: docker://alpine:3\n');
  repo.git('add', '.github/workflows/two.yml');
  repo.git('commit', '-q', '-m', 'docker');
  repo.git('push', '-q', 'origin', 'main');
  expect(runGuard(repo).status).toBe(0);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('scans an unpushed side branch while main is checked out', () => {
  const repo = makeRepo();
  repo.git('switch', '-q', '-c', 'side');
  const sha = addAndRemove(repo);
  repo.git('switch', '-q', 'main');
  const { status, output } = runGuard(repo);
  expect(status).toBe(1);
  expect(output).toContain(`${sha} notes.md: matches denylist pattern`);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('finds a term when the repo sets diff.noprefix', () => {
  const repo = makeRepo();
  repo.git('config', 'diff.noprefix', 'true');
  const sha = addAndRemove(repo);
  expect(runGuard(repo).output).toContain(`${sha} notes.md: matches denylist pattern`);
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});

test('names a non-ASCII file that holds a term', () => {
  const repo = makeRepo();
  repo.write('naïve.md', 'forbiddenterm\n');
  repo.git('add', 'naïve.md');
  repo.git('commit', '-q', '-m', 'non-ascii');
  repo.write('naïve.md', 'clean\n');
  repo.git('commit', '-q', '-am', 'clean');
  const { status, output } = runGuard(repo);
  expect(status).toBe(1);
  expect(output).toContain('naïve.md: matches denylist pattern');
  rmSync(join(repo.dir, '..'), { recursive: true, force: true });
});
