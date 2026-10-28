import { expect, test } from '@fixtures/conduit';

test('worker user can log in with its credentials', async ({ api, workerUser, workerCredentials }) => {
  const user = await test.step('log in as the worker user', () =>
    api.auth.login(workerCredentials.email, workerCredentials.password),
  );

  expect(user.username).toBe(workerUser.username);
});

test('article fixture is readable through the API', async ({ api, article }) => {
  const fetched = await test.step('get the article', () => api.articles.get(article.slug));

  expect(fetched.title).toBe(article.title);
});

test('teardown tolerates an article the test already removed', async ({ api, article }) => {
  await test.step('remove the article', () => api.articles.remove(article.slug));

  await expect(api.articles.get(article.slug)).rejects.toMatchObject({ status: 404 });
});

test.describe('each test owns its article', () => {
  test('first test sees its own article', async ({ api, article }) => {
    const fetched = await test.step('get the article', () => api.articles.get(article.slug));

    expect(fetched.title).toBe(article.title);
  });

  test('second test sees its own article', async ({ api, article }) => {
    const fetched = await test.step('get the article', () => api.articles.get(article.slug));

    expect(fetched.title).toBe(article.title);
  });
});
