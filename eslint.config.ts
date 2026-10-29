import js from '@eslint/js';
import type { Linter } from 'eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

type Layer = 'config' | 'utils' | 'api' | 'components' | 'data' | 'pages' | 'fixtures';
type UatLayer = 'config' | 'components' | 'pages' | 'fixtures';
type RestrictedPath = { name: string; message: string; allowTypeImports?: boolean; allowImportNames?: string[] };

const playwrightTypesOnly: RestrictedPath = {
  name: '@playwright/test',
  allowTypeImports: true,
  message: 'Only type imports from @playwright/test outside src/fixtures.',
};
const playwrightExpectOnly: RestrictedPath = {
  name: '@playwright/test',
  allowTypeImports: true,
  allowImportNames: ['expect'],
  message: 'Components and pages may import only expect and types from @playwright/test.',
};
const playwrightBanned: RestrictedPath = {
  name: '@playwright/test',
  message: 'Import test/expect from the AUT fixtures.',
};

const uatPatterns = (uatLayers?: UatLayer[]) =>
  uatLayers === undefined
    ? [
        { group: ['@uat', '@uat/*'], message: 'Core must not import @uat.' },
        { regex: '(^|/)private(/|$)', message: 'Core must not import private/.' },
      ]
    : uatLayers.map((layer) => ({
        group: [`@uat/src/${layer}`, `@uat/src/${layer}/*`],
        message: `Layering: @uat/src/${layer} is not allowed here.`,
      }));

const restrict = (
  files: string[],
  layers: Layer[],
  paths: RestrictedPath[] = [playwrightTypesOnly],
  uatLayers?: UatLayer[],
): Linter.Config => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths,
        patterns: [
          ...layers.map((layer) => ({ group: [`@${layer}`, `@${layer}/*`], message: `Layering: @${layer} is not allowed here.` })),
          ...uatPatterns(uatLayers),
          { regex: '^\\.\\./', message: 'Use a path alias instead of a deep relative import.' },
        ],
      },
    ],
  },
});

export default defineConfig(
  globalIgnores(['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', '.auth/']),
  js.configs.recommended,
  { rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] } },
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
    files: ['tests/**/*.ts', 'private/tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-nth-methods': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^verify'] }],
      'playwright/no-conditional-in-test': 'error',
      'playwright/valid-title': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-focused-test': 'error',
    },
  },
  restrict(['src/config/**/*.ts'], ['utils', 'api', 'components', 'data', 'pages', 'fixtures']),
  restrict(['src/utils/**/*.ts'], ['api', 'components', 'data', 'pages', 'fixtures']),
  restrict(['src/api/**/*.ts'], ['components', 'pages', 'fixtures']),
  restrict(['src/components/**/*.ts'], ['api', 'pages', 'fixtures'], [playwrightExpectOnly]),
  restrict(['src/data/**/*.ts'], ['api', 'components', 'pages', 'fixtures']),
  restrict(['src/pages/**/*.ts'], ['fixtures'], [playwrightExpectOnly]),
  restrict(['src/fixtures/**/*.ts'], [], []),
  { files: ['src/fixtures/**/*.ts'], rules: { '@typescript-eslint/no-generated-empty-object-type': 'off' } },
  restrict(['tests/**/*.ts'], ['api', 'components', 'pages'], [playwrightBanned]),
  restrict(['tests/unit/**/*.ts'], [], []),
  restrict(
    ['private/src/config/**/*.ts'],
    ['utils', 'api', 'components', 'data', 'pages', 'fixtures'],
    [playwrightTypesOnly],
    ['components', 'pages', 'fixtures'],
  ),
  restrict(['private/src/components/**/*.ts'], ['api', 'pages', 'fixtures'], [playwrightExpectOnly], ['pages', 'fixtures']),
  restrict(['private/src/pages/**/*.ts'], ['fixtures'], [playwrightExpectOnly], ['fixtures']),
  restrict(['private/src/fixtures/**/*.ts'], [], [], []),
  restrict(['private/tests/**/*.ts'], ['api', 'components', 'pages'], [playwrightBanned], ['components', 'pages']),
);
