import { expect, test } from '@playwright/test';
import { first } from '@utils/array';

test('first returns the first item', () => {
  expect(first(['a', 'b'])).toBe('a');
});

test('first throws on an empty list', () => {
  expect(() => first([])).toThrow('expected at least one item');
});
