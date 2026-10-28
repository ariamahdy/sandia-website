import { ArticlesClient, AuthClient, type ConduitArticle, type ConduitUser } from '@api/conduit';
import { ApiError, createApiContext } from '@api/http-client';
import { buildArticle, buildUser, type NewUser } from '@data/conduit';
import { test as base, expect } from './base';

type ConduitApi = { auth: AuthClient; articles: ArticlesClient };
type TestFixtures = { api: ConduitApi; article: ConduitArticle };
type WorkerFixtures = { workerCredentials: Readonly<NewUser>; workerUser: ConduitUser };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerCredentials: [
    async ({}, use) => {
      await use(Object.freeze(buildUser()));
    },
    { scope: 'worker' },
  ],
  workerUser: [
    async ({ env, playwright, workerCredentials }, use) => {
      const ctx = await createApiContext(playwright.request, env.API_URL);
      const user = await new AuthClient(ctx).register(workerCredentials).finally(() => ctx.dispose());
      await use(user);
    },
    { scope: 'worker' },
  ],
  api: async ({ env, playwright, workerUser }, use) => {
    const ctx = await createApiContext(playwright.request, env.API_URL, workerUser.token);
    await use({ auth: new AuthClient(ctx), articles: new ArticlesClient(ctx) });
    await ctx.dispose();
  },
  article: async ({ api }, use) => {
    const article = await api.articles.create(buildArticle());
    await use(article);
    await api.articles.remove(article.slug).catch((error: unknown) => {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    });
  },
});

export { expect };
