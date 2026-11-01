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

const run = (cwd: string): { status: number | null; stdout: string } => {
  const result = spawnSync('node', [script], { cwd, encoding: 'utf8' });
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
