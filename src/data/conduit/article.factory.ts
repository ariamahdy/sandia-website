import { uniqueId } from '@utils/string';

export type NewArticle = { title: string; description: string; body: string; tagList: string[] };

export const buildArticle = (overrides: Partial<NewArticle> = {}): NewArticle => {
  const title = overrides.title ?? uniqueId('article');
  return { title, description: `About ${title}`, body: `Body of ${title}`, tagList: [uniqueId('tag')], ...overrides };
};
