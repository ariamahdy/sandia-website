import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { maskSnapshot } from './lib/mask.mjs';

const source = 'test-results';
const target = 'shared-errors';

const errorFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return errorFiles(path);
    return entry.name === 'error-context.md' ? [path] : [];
  });

const files = existsSync(source) ? errorFiles(source) : [];
rmSync(target, { recursive: true, force: true });
if (files.length === 0) {
  console.log(`error-share: no error files in ${source}`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of files) {
  const name = `${basename(dirname(file))}.md`;
  const result = maskSnapshot(readFileSync(file, 'utf8'));
  writeFileSync(join(target, name), result.text);
  console.log(`error-share: ${name}: masked ${String(result.masked)} values`);
}
console.log(`error-share: ${String(files.length)} error files in ${target}`);
