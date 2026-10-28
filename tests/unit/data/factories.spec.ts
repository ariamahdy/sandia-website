import { expect, test } from '@playwright/test';
import { buildArticle, buildUser } from '@data/conduit';
import { uniqueId } from '@utils/string';

test('uniqueId is prefixed and lower-case', () => {
  expect(uniqueId('User')).toMatch(/^user-[0-9a-f-]{36}$/);
});

test('two users differ in username and email', () => {
  const [a, b] = [buildUser(), buildUser()];
  expect(a.username).not.toBe(b.username);
  expect(a.email).not.toBe(b.email);
});

test('user email derives from username and password is long enough', () => {
  const user = buildUser();
  expect(user.email).toBe(`${user.username}@example.test`);
  expect(user.password.length).toBeGreaterThanOrEqual(12);
});

test('user overrides win', () => {
  expect(buildUser({ username: 'alice', password: 'override-password' })).toMatchObject({
    username: 'alice',
    email: 'alice@example.test',
    password: 'override-password',
  });
});

test('article overrides win', () => {
  expect(buildArticle({ title: 'Fixed title', tagList: [] })).toMatchObject({ title: 'Fixed title', tagList: [] });
});

test('article titles are unique across 1000 calls', () => {
  expect(new Set(Array.from({ length: 1000 }, () => buildArticle().title)).size).toBe(1000);
});
