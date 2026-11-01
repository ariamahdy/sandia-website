import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const script = resolve('scripts/private-guard.mjs');
const isolatedConfig = join(mkdtempSync(join(tmpdir(), 'pguard-config-')), 'gitconfig');
writeFileSync(isolatedConfig, '');
const env = { ...process.env, GIT_CONFIG_GLOBAL: isolatedConfig, GIT_CONFIG_NOSYSTEM: '1' };
const password = 'Invented-Pa55word';

type Repo = { dir: string; git: (...args: string[]) => string; write: (path: string, text: string) => void; commit: (path: string, text: string) => void };

const makeRepo = (): Repo => {
  const root = mkdtempSync(join(tmpdir(), 'pguard-'));
  const dir = join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', join(root, 'remote.git')], { env });
  execFileSync('git', ['init', '-q', '-b', 'main', dir], { env });
  const git = (...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.test', ...args], { cwd: dir, encoding: 'utf8', env });
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (path: string, text: string): void => {
    write(path, text);
    git('add', '-f', path);
    git('commit', '-q', '-m', `add ${path}`);
  };
  git('remote', 'add', 'origin', join(root, 'remote.git'));
  write('.gitignore', '.env\n');
  write('.env', `AUTH_USERNAME=someone@example.test\nAUTH_PASSWORD=${password}\n`);
  commit('README.md', 'clean\n');
  git('push', '-q', 'origin', 'main');
  return { dir, git, write, commit };
};

const run = (dir: string): { status: number | null; out: string } => {
  const result = spawnSync('node', [script], { cwd: dir, encoding: 'utf8', env });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
};

test('a clean private repo passes', () => {
  const { dir } = makeRepo();
  const { status, out } = run(dir);

  expect(status).toBe(0);
  expect(out).toContain('private-guard: ok');
});

test('a tracked env file fails, the example file passes', () => {
  const repo = makeRepo();
  repo.commit('.env.example', 'AUTH_PASSWORD=<password>\n');
  expect(run(repo.dir).status).toBe(0);

  repo.commit('.env', 'AUTH_PASSWORD=x\n');
  const { status, out } = run(repo.dir);
  expect(status).toBe(1);
  expect(out).toContain('.env: env files must not be tracked');
});

test('tracked traces, test results and shared errors fail', () => {
  const repo = makeRepo();
  repo.commit('test-results/a-test/trace.zip', 'zip');
  repo.commit('shared-errors/a-test.md', 'error');
  const { status, out } = run(repo.dir);

  expect(status).toBe(1);
  expect(out).toContain('test-results/a-test/trace.zip');
  expect(out).toContain('shared-errors/a-test.md');
});

test('an unpushed commit that adds the password fails without printing it', () => {
  const repo = makeRepo();
  repo.commit('src/login.ts', `export const p = '${password}';\n`);
  const { status, out } = run(repo.dir);

  expect(status).toBe(1);
  expect(out).toContain('src/login.ts: adds the AUTH_PASSWORD value');
  expect(out).not.toContain(password);
});

test('a password line that is already on the remote is not reported again', () => {
  const repo = makeRepo();
  repo.commit('src/login.ts', `export const p = '${password}';\n`);
  repo.git('push', '-q', 'origin', 'main');

  expect(run(repo.dir).out).not.toContain('adds the AUTH_PASSWORD value');
});

test('without an env file the password check is skipped with a note', () => {
  const repo = makeRepo();
  repo.write('.env', '');
  const { status, out } = run(repo.dir);

  expect(status).toBe(0);
  expect(out).toContain('password check skipped');
});
