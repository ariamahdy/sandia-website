import { expect, type Locator } from '@playwright/test';

export class ArticleList {
  constructor(private readonly root: Locator) {}

  titleHeading(title: string): Locator {
    return this.root.getByRole('heading', { name: title, exact: true });
  }

  async verifyContainsTitle(title: string): Promise<void> {
    await expect(this.titleHeading(title)).toBeVisible();
  }

  async openByTitle(title: string): Promise<void> {
    await this.titleHeading(title).click();
  }
}
