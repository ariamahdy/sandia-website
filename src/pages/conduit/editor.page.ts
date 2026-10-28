import type { Locator, Page } from '@playwright/test';
import { ErrorList } from '@components';
import { errorListRoot } from './layout';

export class EditorPage {
  readonly errorList: ErrorList;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly bodyInput: Locator;
  readonly tagsInput: Locator;
  readonly publishButton: Locator;

  constructor(private readonly page: Page) {
    this.errorList = new ErrorList(errorListRoot(page));
    this.titleInput = page.getByPlaceholder('Article Title');
    this.descriptionInput = page.getByPlaceholder("What's this article about?");
    this.bodyInput = page.getByPlaceholder('Write your article (in markdown)');
    this.tagsInput = page.getByPlaceholder('Enter tags');
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/editor');
  }

  async fillTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  async fillBody(body: string): Promise<void> {
    await this.bodyInput.fill(body);
  }

  async fillTags(tags: readonly string[]): Promise<void> {
    for (const tag of tags) {
      await this.tagsInput.fill(tag);
      await this.tagsInput.press('Enter');
    }
  }

  async clickPublish(): Promise<void> {
    await this.publishButton.click();
  }
}
