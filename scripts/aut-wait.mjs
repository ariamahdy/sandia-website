import { setTimeout as delay } from 'node:timers/promises';

const [url, timeoutArg = '120'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/aut-wait.mjs <url> [timeoutSeconds]');
  process.exit(1);
}

const deadline = Date.now() + Number(timeoutArg) * 1000;
let last = 'no response';

while (Date.now() < deadline) {
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      console.log(`${url} is up`);
      process.exit(0);
    }
    last = `HTTP ${response.status}`;
  } catch (error) {
    last = error instanceof Error ? error.message : String(error);
  }
  await delay(1000);
}

console.error(`${url} not ready after ${timeoutArg}s, last status: ${last}`);
process.exit(1);
