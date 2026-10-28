import { buildArticle } from '@data/conduit';
import { test } from '@fixtures/conduit';
import { first } from '@utils/array';

test('E2E-ART-001 create article via UI then see it on its page', async ({ articlePage, editorPage, trackArticle }) => {
  const draft = buildArticle();

  await test.step('open the editor', () => editorPage.goto());

  await test.step('fill title', () => editorPage.fillTitle(draft.title));

  await test.step('fill description', () => editorPage.fillDescription(draft.description));

  await test.step('fill body', () => editorPage.fillBody(draft.body));

  await test.step('fill tags', () => editorPage.fillTags(draft.tagList));

  await test.step('click publish', () => editorPage.clickPublish());

  await test.step('verify the article page opened', () => articlePage.verifyOpened());

  await test.step('track the article for cleanup', () => {
    trackArticle(articlePage.slugFromUrl());
  });

  await test.step('verify the article title', () => articlePage.verifyTitle(draft.title));
});

test('E2E-ART-002 article created via API appears in the list', async ({ article, homePage }) => {
  await test.step('open the home feed for the article tag', () => homePage.gotoTag(first(article.tagList)));

  await test.step('verify the article is listed', () => homePage.articleList.verifyContainsTitle(article.title));
});
