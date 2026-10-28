import type { Locator, Page } from '@playwright/test';
import { ErrorList, Navbar } from '@components';
import { errorListRoot, navbarRoot } from './layout';

export class LoginPage {
  readonly navbar: Navbar;
  readonly errorList: ErrorList;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(private readonly page: Page) {
    this.navbar = new Navbar(navbarRoot(page));
    this.errorList = new ErrorList(errorListRoot(page));
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickSignIn(): Promise<void> {
    await this.signInButton.click();
  }
}
