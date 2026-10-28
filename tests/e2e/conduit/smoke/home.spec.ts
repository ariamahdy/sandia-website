import { test } from '@fixtures/conduit';

test('E2E-HOME-001 home page loads signed in', async ({ homePage, workerUser }) => {
  await test.step('open the home page', () => homePage.goto());

  await test.step('verify the worker user is signed in', () => homePage.navbar.verifySignedIn(workerUser.username));
});
