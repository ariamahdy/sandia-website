const named = /^(\s*- (?:cell|row|gridcell|option|listitem) )"(?:[^"\\]|\\.)*"/;
const valued = /^(\s*- (?:textbox|cell|gridcell|combobox)(?: "(?:[^"\\]|\\.)*")?(?: \[[^\]]*\])*): .+$/;

export const maskSnapshot = (text) => {
  let inSnapshot = false;
  let snapshots = 0;
  let masked = 0;
  const lines = text.split(/(?<=\n)/).map((line) => {
    const body = line.replace(/\r?\n$/, '');
    const end = line.slice(body.length);
    if (body.startsWith('```')) {
      inSnapshot = !inSnapshot && body.startsWith('```yaml');
      if (inSnapshot) snapshots += 1;
      return line;
    }
    if (!inSnapshot) return line;
    let next = body.replace(named, (_, head) => `${head}"<masked>"`);
    next = next.replace(valued, (_, head) => `${head}: <masked>`);
    if (next !== body) masked += 1;
    return next + end;
  });
  return { text: lines.join(''), snapshots, masked };
};
