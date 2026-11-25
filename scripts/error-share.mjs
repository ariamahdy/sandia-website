import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { maskEnvValues, maskSnapshot } from './lib/mask.mjs';

const source = 'test-results';
const target = 'shared-errors';

const { values: options } = parseArgs({ options: { 'mask-env': { type: 'string', multiple: true, default: [] } } });

const readEnv = (paths) =>
  paths.reduce((env, path) => {
    if (!existsSync(path)) {
      console.log(`error-share: ${path} not found, env values not masked`);
      return env;
    }
    return { ...env, ...parseEnv(readFileSync(path, 'utf8')) };
  }, {});

const errorFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return errorFiles(path);
    return entry.name === 'error-context.md' ? [path] : [];
  });

const env = readEnv(options['mask-env']);
const files = existsSync(source) ? errorFiles(source) : [];
rmSync(target, { recursive: true, force: true });
if (files.length === 0) {
  console.log(`error-share: no error files in ${source}`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of files) {
  const name = `${basename(dirname(file))}.md`;
  const snapshot = maskSnapshot(readFileSync(file, 'utf8'));
  const result = maskEnvValues(snapshot.text, env);
  writeFileSync(join(target, name), result.text);
  console.log(`error-share: ${name}: masked ${String(snapshot.masked)} values, ${String(result.masked)} env values`);
}
console.log(`error-share: ${String(files.length)} error files in ${target}`);
