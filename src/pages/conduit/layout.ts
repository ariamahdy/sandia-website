import type { Locator, Page } from '@playwright/test';

export const navbarRoot = (page: Page): Locator =>
  page.getByRole('navigation').filter({ has: page.getByRole('link', { name: 'Conduit' }) });

export const errorListRoot = (page: Page): Locator => page.locator('.error-messages');
