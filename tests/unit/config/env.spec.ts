import { expect, test } from '@playwright/test';
import { ConfigError, envFileFor, loadEnv } from '@config/env';

const conduit = { AUT: 'conduit', BASE_URL: 'https://app.example.test', API_URL: 'https://api.example.test/api' };

const issuesOf = (source: NodeJS.ProcessEnv): readonly string[] => {
  try {
    loadEnv(source);
  } catch (error) {
    if (error instanceof ConfigError) return error.issues;
    throw error;
  }
  throw new Error('expected ConfigError');
};

const issueFor = (key: string) => expect.stringMatching(new RegExp(`^${key}: `));

test('valid conduit env returns typed values', () => {
  expect(loadEnv(conduit)).toEqual(conduit);
});

test('empty env reports every missing variable at once', () => {
  expect(issuesOf({})).toEqual(expect.arrayContaining([issueFor('AUT'), issueFor('BASE_URL'), issueFor('API_URL')]));
});

test('uat env without credentials reports both credentials', () => {
  expect(issuesOf({ ...conduit, AUT: 'uat' })).toEqual(
    expect.arrayContaining([issueFor('AUTH_USERNAME'), issueFor('AUTH_PASSWORD')]),
  );
});

test('invalid BASE_URL is named in the issues', () => {
  expect(issuesOf({ ...conduit, BASE_URL: 'not-a-url' })).toEqual(expect.arrayContaining([issueFor('BASE_URL')]));
});

test('result is frozen', () => {
  expect(Object.isFrozen(loadEnv(conduit))).toBe(true);
});

test('uat loads its settings from private/.env', () => {
  expect(envFileFor({ AUT: 'uat' })).toBe('private/.env');
});

test('any other AUT loads .env', () => {
  expect(envFileFor({})).toBe('.env');
  expect(envFileFor({ AUT: 'conduit' })).toBe('.env');
});
