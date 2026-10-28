import type { APIRequestContext } from '@playwright/test';
import type { NewUser } from '@data/conduit';
import { parseResponse } from '@api/http-client';
import { type ConduitUser, userResponseSchema } from './schemas';

export class AuthClient {
  constructor(private readonly ctx: APIRequestContext) {}

  async register(user: NewUser): Promise<ConduitUser> {
    const response = await this.ctx.post('users', { data: { user } });
    return (await parseResponse('POST /users', response, userResponseSchema)).user;
  }

  async login(email: string, password: string): Promise<ConduitUser> {
    const response = await this.ctx.post('users/login', { data: { user: { email, password } } });
    return (await parseResponse('POST /users/login', response, userResponseSchema)).user;
  }
}
