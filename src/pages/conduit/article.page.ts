import { expect, type Locator, type Page } from '@playwright/test';

export class ArticlePage {
  readonly deleteButton: Locator;

  constructor(private readonly page: Page) {
    this.deleteButton = page.locator('.banner').getByRole('button', { name: 'Delete Article' });
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/article/${slug}`);
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  }

  async verifyOpened(): Promise<void> {
    await expect(this.page).toHaveURL(/\/article\/[^/]+$/);
  }

  slugFromUrl(): string {
    return new URL(this.page.url()).pathname.replace(/^\/article\//, '');
  }

  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
  }
}
