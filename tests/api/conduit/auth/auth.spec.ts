import { buildUser } from '@data/conduit';
import { expect, test } from '@fixtures/conduit';

test('API-AUTH-001 register returns a token', async ({ api }) => {
  const newUser = buildUser();

  const registered = await test.step('register a new user', () => api.auth.register(newUser));

  expect(registered.username).toBe(newUser.username);
  expect(registered.token).not.toBe('');
});

test('API-AUTH-002 login with wrong password is rejected', async ({ api, workerCredentials }) => {
  await test.step('log in with a wrong password', async () => {
    await expect(api.auth.login(workerCredentials.email, 'wrong-password-123')).rejects.toMatchObject({
      status: 403,
      endpoint: 'POST /users/login',
    });
  });
});
