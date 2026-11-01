import { readFileSync, writeFileSync } from 'node:fs';
import { maskSnapshot } from './lib/mask.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run mask:snapshot -- <error file>');
  process.exit(1);
}

let text;
try {
  text = readFileSync(file, 'utf8');
} catch {
  console.error(`mask-snapshot: cannot read ${file}`);
  process.exit(1);
}

const result = maskSnapshot(text);
if (result.snapshots === 0) {
  console.log(`mask-snapshot: no page snapshot in ${file}, left unchanged`);
} else {
  writeFileSync(file, result.text);
  console.log(`mask-snapshot: masked ${String(result.masked)} values in ${file}`);
}
