import type { APIRequestContext } from '@playwright/test';
import type { NewArticle } from '@data/conduit';
import { expectOk, parseResponse } from '@api/http-client';
import { articleResponseSchema, type ConduitArticle } from './schemas';

export class ArticlesClient {
  constructor(private readonly ctx: APIRequestContext) {}

  async create(article: NewArticle): Promise<ConduitArticle> {
    const response = await this.ctx.post('articles', { data: { article } });
    return (await parseResponse('POST /articles', response, articleResponseSchema)).article;
  }

  async get(slug: string): Promise<ConduitArticle> {
    const response = await this.ctx.get(`articles/${slug}`);
    return (await parseResponse(`GET /articles/${slug}`, response, articleResponseSchema)).article;
  }

  async remove(slug: string): Promise<void> {
    expectOk(`DELETE /articles/${slug}`, await this.ctx.delete(`articles/${slug}`));
  }
}
