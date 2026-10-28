import { randomUUID } from 'node:crypto';

export const uniqueId = (prefix: string): string => `${prefix}-${randomUUID()}`.toLowerCase();
