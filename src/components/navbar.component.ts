import { expect, type Locator } from '@playwright/test';

export class Navbar {
  readonly signInLink: Locator;
  readonly newArticleLink: Locator;
  readonly settingsLink: Locator;

  constructor(private readonly root: Locator) {
    this.signInLink = root.getByRole('link', { name: 'Sign in' });
    this.newArticleLink = root.getByRole('link', { name: 'New Article' });
    this.settingsLink = root.getByRole('link', { name: 'Settings' });
  }

  userLink(username: string): Locator {
    return this.root.getByRole('link', { name: username });
  }

  async verifySignedIn(username: string): Promise<void> {
    await expect(this.userLink(username)).toBeVisible();
  }

  async verifySignedOut(): Promise<void> {
    await expect(this.signInLink).toBeVisible();
  }

  async clickNewArticle(): Promise<void> {
    await this.newArticleLink.click();
  }

  async clickSettings(): Promise<void> {
    await this.settingsLink.click();
  }
}
