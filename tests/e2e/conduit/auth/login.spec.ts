import { test } from '@fixtures/conduit';

test.use({ storageState: { cookies: [], origins: [] } });

test('E2E-AUTH-001 login with valid credentials', async ({ loginPage, workerCredentials, workerUser }) => {
  await test.step('open the login page', () => loginPage.goto());

  await test.step('fill email', () => loginPage.fillEmail(workerCredentials.email));

  await test.step('fill password', () => loginPage.fillPassword(workerCredentials.password));

  await test.step('click sign in', () => loginPage.clickSignIn());

  await test.step('verify the user is signed in', () => loginPage.navbar.verifySignedIn(workerUser.username));
});

test('E2E-AUTH-002 login with wrong password shows an error', async ({ loginPage, workerCredentials }) => {
  await test.step('open the login page', () => loginPage.goto());

  await test.step('fill email', () => loginPage.fillEmail(workerCredentials.email));

  await test.step('fill a wrong password', () => loginPage.fillPassword('wrong-password-123'));

  await test.step('click sign in', () => loginPage.clickSignIn());

  await test.step('verify the error message', () => loginPage.errorList.verifyMessage('email or password is invalid'));

  await test.step('verify the user is still signed out', () => loginPage.navbar.verifySignedOut());
});
