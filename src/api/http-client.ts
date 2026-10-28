import type { APIRequest, APIRequestContext, APIResponse } from '@playwright/test';
import type { z } from 'zod';

export type ResponseLike = Pick<APIResponse, 'ok' | 'status' | 'json'>;

export class ApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
  ) {
    super(`${endpoint} failed with HTTP ${String(status)}`);
    this.name = 'ApiError';
  }
}

export class ContractError extends Error {
  constructor(
    readonly endpoint: string,
    readonly issues: readonly string[],
  ) {
    super(`${endpoint} response violates its contract:\n${issues.join('\n')}`);
    this.name = 'ContractError';
  }
}

export const parseResponse = async <T>(endpoint: string, response: ResponseLike, schema: z.ZodType<T>): Promise<T> => {
  if (!response.ok()) throw new ApiError(endpoint, response.status());
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    throw new ContractError(
      endpoint,
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    );
  }
  return result.data;
};

export const expectOk = (endpoint: string, response: ResponseLike): void => {
  if (!response.ok()) throw new ApiError(endpoint, response.status());
};

export const createApiContext = (request: APIRequest, baseURL: string, token?: string): Promise<APIRequestContext> =>
  request.newContext({
    baseURL: baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
    extraHTTPHeaders: token === undefined ? {} : { Authorization: `Token ${token}` },
  });
