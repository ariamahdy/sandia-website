import { uniqueId } from '@utils/string';

export type NewUser = { username: string; email: string; password: string };

export const buildUser = (overrides: Partial<NewUser> = {}): NewUser => {
  const username = overrides.username ?? uniqueId('user');
  return { username, email: `${username}@example.test`, password: uniqueId('pass'), ...overrides };
};
