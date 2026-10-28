import { expect, type Locator } from '@playwright/test';

export class ErrorList {
  constructor(private readonly root: Locator) {}

  async verifyMessage(text: string | RegExp): Promise<void> {
    await expect(this.root).toContainText(text);
  }
}
