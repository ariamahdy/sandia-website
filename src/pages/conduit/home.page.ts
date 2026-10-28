import type { Page } from '@playwright/test';
import { ArticleList, Navbar } from '@components';
import { navbarRoot } from './layout';

export class HomePage {
  readonly navbar: Navbar;
  readonly articleList: ArticleList;

  constructor(private readonly page: Page) {
    this.navbar = new Navbar(navbarRoot(page));
    this.articleList = new ArticleList(page.locator('app-article-list'));
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }
}
