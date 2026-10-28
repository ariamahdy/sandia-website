import { expect, test } from '@playwright/test';
import { articleResponseSchema } from '@api/conduit';
import { ApiError, ContractError, parseResponse, type ResponseLike } from '@api/http-client';

const fakeResponse = (status: number, body: unknown): ResponseLike => ({
  ok: () => status >= 200 && status < 300,
  status: () => status,
  json: () => Promise.resolve(body),
});

const article = {
  slug: 'a-1',
  title: 'A',
  description: 'About A',
  body: 'Body of A',
  tagList: ['t'],
  author: { username: 'alice' },
};

test('non-2xx throws ApiError with status and endpoint', async () => {
  const error: unknown = await parseResponse('GET /articles/x', fakeResponse(404, {}), articleResponseSchema).catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 404, endpoint: 'GET /articles/x' });
});

test('schema mismatch throws ContractError naming the endpoint and field', async () => {
  const error: unknown = await parseResponse(
    'POST /articles',
    fakeResponse(200, { article: { ...article, slug: undefined } }),
    articleResponseSchema,
  ).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ContractError);
  expect(error).toMatchObject({ endpoint: 'POST /articles' });
  expect((error as ContractError).issues).toEqual(expect.arrayContaining([expect.stringMatching(/slug/)]));
});

test('valid body returns the parsed value', async () => {
  await expect(parseResponse('GET /articles/a-1', fakeResponse(200, { article }), articleResponseSchema)).resolves.toEqual(
    { article },
  );
});
