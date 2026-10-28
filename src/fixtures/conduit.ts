import { ArticlesClient, AuthClient, type ConduitArticle, type ConduitUser } from '@api/conduit';
import { ApiError, createApiContext } from '@api/http-client';
import { buildArticle, buildUser, type NewUser } from '@data/conduit';
import { ArticlePage, EditorPage, HomePage, LoginPage } from '@pages/conduit';
import { test as base, expect } from './base';

type ConduitApi = { auth: AuthClient; articles: ArticlesClient };
type TestFixtures = {
  api: ConduitApi;
  article: ConduitArticle;
  homePage: HomePage;
  loginPage: LoginPage;
  editorPage: EditorPage;
  articlePage: ArticlePage;
};
type WorkerFixtures = { workerCredentials: Readonly<NewUser>; workerUser: ConduitUser; workerStorageState: string };

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
  workerStorageState: [
    async ({ browser, env, workerCredentials, workerUser }, use, workerInfo) => {
      const path = `.auth/${env.AUT}-${String(workerInfo.parallelIndex)}.json`;
      const context = await browser.newContext({ baseURL: env.BASE_URL });
      const loginPage = new LoginPage(await context.newPage());
      await loginPage.goto();
      await loginPage.fillEmail(workerCredentials.email);
      await loginPage.fillPassword(workerCredentials.password);
      await loginPage.clickSignIn();
      await loginPage.navbar.verifySignedIn(workerUser.username);
      await context.storageState({ path });
      await context.close();
      await use(path);
    },
    { scope: 'worker' },
  ],
  storageState: async ({ workerStorageState }, use) => {
    await use(workerStorageState);
  },
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
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },
  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },
});

export { expect };
