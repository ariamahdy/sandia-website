const named = /^(\s*- (?:cell|row|gridcell|option|listitem) )"(?:[^"\\]|\\.)*"/;
const valued = /^(\s*- (?:textbox|cell|gridcell|combobox)(?: "(?:[^"\\]|\\.)*")?(?: \[[^\]]*\])*): .+$/;
const container = /^(\s*)- (?:row|cell|gridcell)\b/;
const anyName = /^(\s*- [\w-]+ )"(?:[^"\\]|\\.)*"/;
const anyValue = /^(\s*- [\w-]+(?: "(?:[^"\\]|\\.)*")?(?: \[[^\]]*\])*): .+$/;
const header = /^\s*- columnheader\b/;
const url = /^(\s*- \/url: )(.+)$/;
const longDigits = /\d{6,}/g;

const maskUrl = (value) => {
  const [path = '', query] = value.split('?');
  const origin = /^[a-z][\w+.-]*:\/\/[^/]+/i.exec(path)?.[0] ?? '';
  const segments = path
    .slice(origin.length)
    .split('/')
    .map((segment) => (/\d/.test(segment) ? '<masked>' : segment));
  return origin + segments.join('/') + (query === undefined ? '' : '?<masked>');
};

const indentOf = (line) => line.length - line.trimStart().length;

export const maskSnapshot = (text) => {
  let inSnapshot = false;
  let snapshots = 0;
  let masked = 0;
  let subtree = -1;
  const lines = text.split(/(?<=\n)/).map((line) => {
    const body = line.replace(/\r?\n$/, '');
    const end = line.slice(body.length);
    if (body.startsWith('```')) {
      inSnapshot = !inSnapshot && body.startsWith('```yaml');
      if (inSnapshot) snapshots += 1;
      subtree = -1;
      return line;
    }
    if (!inSnapshot) return line;
    if (subtree >= 0 && indentOf(body) <= subtree) subtree = -1;
    let next = body.replace(url, (_, head, value) => `${head}${maskUrl(value)}`);
    if (subtree >= 0 && !header.test(next) && !url.test(next)) {
      next = next.replace(anyName, (_, head) => `${head}"<masked>"`);
      next = next.replace(anyValue, (_, head) => `${head}: <masked>`);
    }
    next = next.replace(named, (_, head) => `${head}"<masked>"`);
    next = next.replace(valued, (_, head) => `${head}: <masked>`);
    next = next.replace(longDigits, '<masked>');
    const opens = container.exec(body);
    if (opens && subtree < 0) subtree = opens[1].length;
    if (next !== body) masked += 1;
    return next + end;
  });
  return { text: lines.join(''), snapshots, masked };
};

const minEnvLength = 3;
const publicEnvKeys = new Set(['AUT']);
const publicEnvValue = /^(true|false)$/i;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const envMarkers = (env) => {
  const markers = new Map();
  for (const [key, raw] of Object.entries(env)) {
    const value = raw.trim();
    if (publicEnvKeys.has(key) || publicEnvValue.test(value)) continue;
    const parts = value.split(' - ');
    const entries = [[value, `<env:${key}>`], ...(parts.length > 1 ? parts.map((part, index) => [part.trim(), `<env:${key}#${String(index + 1)}>`]) : [])];
    for (const [text, marker] of entries) {
      if (text.length >= minEnvLength && !markers.has(text)) markers.set(text, marker);
    }
  }
  return markers;
};

export const maskEnvValues = (text, env) => {
  const markers = envMarkers(env);
  if (markers.size === 0) return { text, masked: 0 };
  const values = [...markers.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![A-Za-z0-9])(?:${values.join('|')})(?![A-Za-z0-9])`, 'g');
  let masked = 0;
  const result = text.replace(pattern, (value) => {
    masked += 1;
    return markers.get(value) ?? value;
  });
  return { text: result, masked };
};
