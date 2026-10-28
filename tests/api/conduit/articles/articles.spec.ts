import { expect, test } from '@fixtures/conduit';

test('API-ART-001 create then fetch article', async ({ api, article, workerUser }) => {
  const fetched = await test.step('fetch the created article', () => api.articles.get(article.slug));

  expect(fetched).toEqual(article);
  expect(fetched.author.username).toBe(workerUser.username);
});

test('API-ART-002 deleted article is not retrievable', async ({ api, article }) => {
  await test.step('delete the article', () => api.articles.remove(article.slug));

  await test.step('fetch the deleted article', async () => {
    await expect(api.articles.get(article.slug)).rejects.toMatchObject({ status: 404 });
  });
});
