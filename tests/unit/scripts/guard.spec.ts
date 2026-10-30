import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const guard = resolve('scripts/guard.mjs');

type Repo = { dir: string; git: (...args: string[]) => string; write: (path: string, text: string) => void };

const makeRepo = (): Repo => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  const dir = join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', join(root, 'remote.git')]);
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  const git = (...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.test', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: dir,
      encoding: 'utf8',
    });
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
  const result = spawnSync('node', [guard], { cwd: repo.dir, encoding: 'utf8' });
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
