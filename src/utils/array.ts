export const first = <T>(items: readonly T[]): T => {
  const [item] = items;
  if (item === undefined) throw new Error('expected at least one item');
  return item;
};
