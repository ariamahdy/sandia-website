import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const script = resolve('scripts/mask-snapshot.mjs');

const errorFile = [
  '# Error details',
  '',
  '```',
  'Error: expect(locator).toHaveText(expected) failed',
  '```',
  '',
  '# Page snapshot',
  '',
  '```yaml',
  '- main [ref=e1]:',
  '  - columnheader "NIK" [ref=e2]',
  '  - row "Jane Roe 3100000000000001" [ref=e3]:',
  '    - cell "Jane Roe" [ref=e4]',
  '    - cell: 3100000000000001',
  '  - text: Alamat harus diisi',
  '  - textbox: "081200000000"',
  '  - textbox "Email" [ref=e5]: jane@example.test',
  '  - textbox "Cabang" [ref=e6]',
  '  - option "Jane Roe" [ref=e7]',
  '  - button "Submit" [ref=e8]',
  '```',
  '',
  '# Test source',
  '',
  '```ts',
  "  await page.getByRole('cell', { name: 'x' }).click();",
  '```',
  '',
].join('\n');

const run = (text?: string): { file: string; status: number | null; stdout: string } => {
  const file = join(mkdtempSync(join(tmpdir(), 'mask-')), 'error.txt');
  if (text !== undefined) writeFileSync(file, text);
  const result = spawnSync('node', [script, file], { encoding: 'utf8' });
  return { file, status: result.status, stdout: result.stdout };
};

test('masks the data values of the page snapshot', () => {
  const { file, status, stdout } = run(errorFile);
  const masked = readFileSync(file, 'utf8');

  expect(status).toBe(0);
  expect(stdout).toContain('masked 6 values');
  expect(masked).not.toContain('Jane Roe');
  expect(masked).not.toContain('3100000000000001');
  expect(masked).not.toContain('081200000000');
  expect(masked).not.toContain('jane@example.test');
  expect(masked).toContain('  - row "<masked>" [ref=e3]:');
  expect(masked).toContain('    - cell: <masked>');
  expect(masked).toContain('  - textbox "Email" [ref=e5]: <masked>');
});

test('keeps labels, messages, buttons and the sections around the snapshot', () => {
  const { file } = run(errorFile);
  const masked = readFileSync(file, 'utf8');

  expect(masked).toContain('  - columnheader "NIK" [ref=e2]');
  expect(masked).toContain('  - text: Alamat harus diisi');
  expect(masked).toContain('  - textbox "Cabang" [ref=e6]');
  expect(masked).toContain('  - button "Submit" [ref=e8]');
  expect(masked).toContain('Error: expect(locator).toHaveText(expected) failed');
  expect(masked).toContain("  await page.getByRole('cell', { name: 'x' }).click();");
});

test('masks a snapshot that follows the error details without its own heading', () => {
  const text = [
    '# Error details',
    '',
    '```',
    'Error: expect(locator).toBeVisible() failed',
    '```',
    '',
    '```yaml',
    '- row "Jane Roe":',
    '  - cell "Jane Roe"',
    '- textbox "Email": jane@example.test',
    '```',
    '',
  ].join('\r\n');
  const { file, stdout } = run(text);
  const masked = readFileSync(file, 'utf8');

  expect(stdout).toContain('masked 3 values');
  expect(masked).not.toContain('Jane Roe');
  expect(masked).not.toContain('jane@example.test');
  expect(masked).toContain('\r\n');
});

test('leaves a file without a page snapshot unchanged', () => {
  const text = '# Error details\n\nError: boom\n';
  const { file, status, stdout } = run(text);

  expect(status).toBe(0);
  expect(stdout).toContain('no page snapshot');
  expect(readFileSync(file, 'utf8')).toBe(text);
});

test('fails on a missing file', () => {
  expect(run().status).toBe(1);
});
