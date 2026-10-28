import { z } from 'zod';

const conduitUserSchema = z.object({ username: z.string(), email: z.string(), token: z.string() });
const conduitArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  body: z.string(),
  tagList: z.array(z.string()),
  author: z.object({ username: z.string() }),
});

export const userResponseSchema = z.object({ user: conduitUserSchema });
export const articleResponseSchema = z.object({ article: conduitArticleSchema });

export type ConduitUser = z.infer<typeof conduitUserSchema>;
export type ConduitArticle = z.infer<typeof conduitArticleSchema>;
