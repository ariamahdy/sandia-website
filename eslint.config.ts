import js from '@eslint/js';
import type { Linter } from 'eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

type Layer = 'config' | 'utils' | 'api' | 'components' | 'data' | 'pages' | 'fixtures';
type RestrictedPath = { name: string; message: string; allowTypeImports?: boolean };

const playwrightTypesOnly: RestrictedPath = {
  name: '@playwright/test',
  allowTypeImports: true,
  message: 'Only type imports from @playwright/test outside src/fixtures.',
};
const playwrightBanned: RestrictedPath = {
  name: '@playwright/test',
  message: 'Import test/expect from @fixtures/conduit.',
};

const restrict = (files: string[], layers: Layer[], paths: RestrictedPath[] = [playwrightTypesOnly]): Linter.Config => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths,
        patterns: [
          ...layers.map((layer) => ({ group: [`@${layer}`, `@${layer}/*`], message: `Layering: @${layer} is not allowed here.` })),
          { group: ['@uat', '@uat/*'], message: 'Core must not import @uat.' },
          { regex: '(^|/)private(/|$)', message: 'Core must not import private/.' },
          { regex: '^\\.\\./', message: 'Use a path alias instead of a deep relative import.' },
        ],
      },
    ],
  },
});

export default defineConfig(
  globalIgnores(['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', '.auth/']),
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', fetch: 'readonly' } },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-nth-methods': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/valid-title': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-focused-test': 'error',
    },
  },
  restrict(['src/config/**/*.ts'], ['utils', 'api', 'components', 'data', 'pages', 'fixtures']),
  restrict(['src/utils/**/*.ts'], ['api', 'components', 'data', 'pages', 'fixtures']),
  restrict(['src/api/**/*.ts'], ['components', 'data', 'pages', 'fixtures']),
  restrict(['src/components/**/*.ts'], ['api', 'data', 'pages', 'fixtures']),
  restrict(['src/data/**/*.ts'], ['api', 'components', 'pages', 'fixtures']),
  restrict(['src/pages/**/*.ts'], ['data', 'fixtures']),
  restrict(['src/fixtures/**/*.ts'], [], []),
  restrict(['tests/**/*.ts'], ['api', 'components', 'pages'], [playwrightBanned]),
  restrict(['tests/unit/**/*.ts'], [], []),
);
