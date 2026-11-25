import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const script = resolve('scripts/error-share.mjs');

const errorContext = (name: string): string =>
  ['# Error details', '', '```', `Error: ${name} failed`, '```', '', '```yaml', `- row "Jane Roe ${name}":`, '  - cell "Jane Roe"', '```', ''].join('\n');

const workspace = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'share-'));
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  write('test-results/suite-a-first-test/error-context.md', errorContext('first'));
  write('test-results/suite-b-second-test/error-context.md', errorContext('second'));
  write('test-results/suite-c-third-test/trace.zip', 'binary');
  write('shared-errors/old-run.md', 'stale');
  return dir;
};

const run = (cwd: string, args: readonly string[] = []): { status: number | null; stdout: string } => {
  const result = spawnSync('node', [script, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
};

test('collects every error file of the last run as a masked copy', () => {
  const dir = workspace();
  const { status, stdout } = run(dir);
  const shared = readdirSync(join(dir, 'shared-errors')).sort();

  expect(status).toBe(0);
  expect(shared).toEqual(['suite-a-first-test.md', 'suite-b-second-test.md']);
  for (const file of shared) {
    const text = readFileSync(join(dir, 'shared-errors', file), 'utf8');
    expect(text).not.toContain('Jane Roe');
    expect(text).toContain('<masked>');
    expect(text).toMatch(/Error: (first|second) failed/);
  }
  expect(stdout).toContain('suite-a-first-test.md: masked 2 values');
  expect(stdout).toContain('2 error files in shared-errors');
});

test('leaves the originals in test-results untouched', () => {
  const dir = workspace();
  run(dir);

  expect(readFileSync(join(dir, 'test-results/suite-a-first-test/error-context.md'), 'utf8')).toContain('Jane Roe');
});

test('never copies traces and removes files from an earlier share', () => {
  const dir = workspace();
  run(dir);

  expect(existsSync(join(dir, 'shared-errors/old-run.md'))).toBe(false);
  expect(readdirSync(join(dir, 'shared-errors')).some((f) => f.includes('third'))).toBe(false);
});

test('says so when there are no error files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'share-empty-'));
  const { status, stdout } = run(dir);

  expect(status).toBe(0);
  expect(stdout).toContain('no error files');
});

const maskEnv = ['--mask-env', 'private/.env'];

const envWorkspace = (env: string, error: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'share-env-'));
  mkdirSync(join(dir, 'private'), { recursive: true });
  writeFileSync(join(dir, 'private/.env'), env);
  mkdirSync(join(dir, 'test-results/suite-a-env-test'), { recursive: true });
  writeFileSync(join(dir, 'test-results/suite-a-env-test/error-context.md'), error);
  return dir;
};

const shared = (dir: string): string => readFileSync(join(dir, 'shared-errors/suite-a-env-test.md'), 'utf8');

test('masks every env value in the error message, the locator, the diff and the snapshot', () => {
  const error = [
    '```',
    'Error: no row with "Jane-0042" after the search',
    "Locator: getByRole('row').filter({ hasText: 'Jane-0042' })",
    '- Expected substring  -  1',
    '- Jane-0042',
    '```',
    '```yaml',
    '- text: "Search by Jane-0042"',
    '```',
    '',
  ].join('\n');
  const dir = envWorkspace('SEARCH=Jane-0042\n', error);

  const { status, stdout } = run(dir, maskEnv);
  const text = shared(dir);

  expect(status).toBe(0);
  expect(text).not.toContain('Jane-0042');
  expect(text.match(/<env:SEARCH>/g)).toHaveLength(4);
  expect(stdout).toContain('4 env values');
});

test('masks a "code - name" value whole and each of its parts alone', () => {
  const dir = envWorkspace('CABANG=K12 - Area North\n', 'Error: no "K12 - Area North" here, nor a "K12" cell, nor "Area North"\n');

  run(dir, maskEnv);
  const text = shared(dir);

  expect(text).toBe('Error: no "<env:CABANG>" here, nor a "<env:CABANG#1>" cell, nor "<env:CABANG#2>"\n');
});

test('leaves values shorter than 3 characters and values inside a longer word or number', () => {
  const dir = envWorkspace('SHORT=K1\nCODE=K12\n', 'Error: K1 at line 12, AK123 and K123 differ from K12\n');

  run(dir, maskEnv);

  expect(shared(dir)).toBe('Error: K1 at line 12, AK123 and K123 differ from <env:CODE>\n');
});

test('masks the longest value first when one value holds another', () => {
  const dir = envWorkspace('AREA=Area\nREGION=Area North\n', 'Error: Area North, then Area\n');

  run(dir, maskEnv);

  expect(shared(dir)).toBe('Error: <env:REGION>, then <env:AREA>\n');
});

test('masks env values in a file with Windows line endings', () => {
  const dir = envWorkspace('SEARCH=Jane-0042\r\n', 'Error: Jane-0042\r\nLocator: Jane-0042\r\n');

  run(dir, maskEnv);

  expect(shared(dir)).toBe('Error: <env:SEARCH>\r\nLocator: <env:SEARCH>\r\n');
});

test('still shares the snapshot-masked files and says so when the env file is missing', () => {
  const dir = workspace();
  const { status, stdout } = run(dir, maskEnv);

  expect(status).toBe(0);
  expect(stdout).toContain('private/.env not found, env values not masked');
  expect(readdirSync(join(dir, 'shared-errors'))).toHaveLength(2);
});

test('keeps the AUT name and boolean values, which are not private and appear in every file', () => {
  const dir = envWorkspace('AUT=uat\nTRUST=true\nSEARCH=Jane-0042\n', 'Error: Jane-0042 in tests/e2e/uat (uat-e2e), Expected: true\n');

  run(dir, maskEnv);

  expect(shared(dir)).toBe('Error: <env:SEARCH> in tests/e2e/uat (uat-e2e), Expected: true\n');
});
