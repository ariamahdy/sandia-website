import { readFileSync, writeFileSync } from 'node:fs';

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

const named = /^(\s*- (?:cell|row|gridcell|option|listitem) )"(?:[^"\\]|\\.)*"/;
const valued = /^(\s*- (?:textbox|cell|gridcell|combobox)(?: "(?:[^"\\]|\\.)*")?(?: \[[^\]]*\])*): .+$/;

let inSnapshot = false;
let seenHeading = false;
let masked = 0;
const lines = text.split(/(?<=\n)/).map((line) => {
  const body = line.replace(/\r?\n$/, '');
  const end = line.slice(body.length);
  if (body.startsWith('# ')) seenHeading = body === '# Page snapshot';
  if (seenHeading && body.startsWith('```')) {
    inSnapshot = !inSnapshot && body.startsWith('```yaml');
    return line;
  }
  if (!inSnapshot) return line;
  let next = body.replace(named, (_, head) => `${head}"<masked>"`);
  next = next.replace(valued, (_, head) => `${head}: <masked>`);
  if (next !== body) masked += 1;
  return next + end;
});

if (!text.includes('# Page snapshot')) {
  console.log(`mask-snapshot: no page snapshot in ${file}, left unchanged`);
} else {
  writeFileSync(file, lines.join(''));
  console.log(`mask-snapshot: masked ${String(masked)} values in ${file}`);
}
