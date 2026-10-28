import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [{ name: 'unit', testDir: 'tests/unit' }],
});
