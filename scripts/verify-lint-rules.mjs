import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ESLint } from 'eslint';

const cases = [
  {
    name: 'pages must not import fixtures',
    filePath: 'src/pages/x.ts',
    code: "import { test } from '@fixtures/conduit';\nexport const t = test;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'core must not import @uat',
    filePath: 'src/config/x.ts',
    code: "import { a } from '@uat/anything';\nexport const b = a;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'pages must not import test from @playwright/test',
    filePath: 'src/pages/x.ts',
    code: "import { test } from '@playwright/test';\nexport const t = test;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'pages may import expect from @playwright/test',
    filePath: 'src/pages/x.ts',
    code: "import { expect, type Locator } from '@playwright/test';\nexport const verify = (l: Locator) => expect(l).toBeVisible();\n",
    expect: null,
  },
  {
    name: 'api must not import @playwright/test values',
    filePath: 'src/api/x.ts',
    code: "import { request } from '@playwright/test';\nexport const r = request;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'pages may import @playwright/test types',
    filePath: 'src/pages/x.ts',
    code: "import type { Locator } from '@playwright/test';\nexport type L = Locator;\n",
    expect: null,
  },
  {
    name: 'e2e tests must not import @playwright/test',
    filePath: 'tests/e2e/x.spec.ts',
    code: "import { test, expect } from '@playwright/test';\ntest('a', () => {\n  expect(1).toBe(1);\n});\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'waitForTimeout is banned',
    filePath: 'tests/e2e/x.spec.ts',
    code: "import { test } from '@fixtures/conduit';\ntest('waits', async ({ page }) => {\n  await page.waitForTimeout(1);\n});\n",
    expect: 'playwright/no-wait-for-timeout',
  },
  {
    name: 'test without assertion or verify call is flagged',
    filePath: 'tests/e2e/x.spec.ts',
    code: "import { test } from '@fixtures/conduit';\ntest('no assertion', async ({ homePage }) => {\n  await homePage.goto();\n});\n",
    expect: 'playwright/expect-expect',
  },
  {
    name: 'explicit any is banned',
    filePath: 'src/utils/x.ts',
    code: 'const a: any = 1;\nexport const b = a;\n',
    expect: '@typescript-eslint/no-explicit-any',
  },
  {
    name: 'private tests ban waitForTimeout',
    filePath: 'private/tests/x.spec.ts',
    code: "import { test } from '@fixtures/conduit';\ntest('waits', async ({ page }) => {\n  await page.waitForTimeout(1);\n});\n",
    expect: 'playwright/no-wait-for-timeout',
  },
  {
    name: 'private tests must not import @playwright/test',
    filePath: 'private/tests/x.spec.ts',
    code: "import { test, expect } from '@playwright/test';\ntest('a', () => {\n  expect(1).toBe(1);\n});\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private pages must not import fixtures',
    filePath: 'private/src/pages/x.ts',
    code: "import { test } from '@uat/src/fixtures/uat';\nexport const t = test;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private unit tests may import @playwright/test and pages',
    filePath: 'private/tests/unit/x.spec.ts',
    code: "import { test, expect } from '@playwright/test';\nimport type { LoginPage } from '@uat/src/pages';\nexport type Page = LoginPage;\ntest('a', () => {\n  expect(1).toBe(1);\n});\n",
    expect: null,
  },
  {
    name: 'private data must not import pages',
    filePath: 'private/src/data/x.ts',
    code: "import { LoginPage } from '@uat/src/pages';\nexport const p = LoginPage;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private data must not import @playwright/test',
    filePath: 'private/src/data/x.ts',
    code: "import type { Page } from '@playwright/test';\nexport type P = Page;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private api must not import pages',
    filePath: 'private/src/api/x.ts',
    code: "import { LoginPage } from '@uat/src/pages';\nexport const p = LoginPage;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private api must not import @playwright/test values',
    filePath: 'private/src/api/x.ts',
    code: "import { test } from '@playwright/test';\nexport const t = test;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private api may import private config',
    filePath: 'private/src/api/x.ts',
    code: "import { requireVar } from '@uat/src/config/uat-env';\nexport const r = requireVar;\n",
    expect: null,
  },
  {
    name: 'private components must not import private api',
    filePath: 'private/src/components/x.ts',
    code: "import type { X } from '@uat/src/api/uat-db';\nexport type Y = X;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private e2e tests must not import private api',
    filePath: 'private/tests/e2e/x.spec.ts',
    code: "import type { UatDatabases } from '@uat/src/api/uat-db';\nexport type D = UatDatabases;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private data must not import components',
    filePath: 'private/src/data/x.ts',
    code: "import { escapeRegExp } from '@uat/src/components';\nexport const e = escapeRegExp;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'private config must not import private data',
    filePath: 'private/src/config/x.ts',
    code: "import type { Builder } from '@uat/src/data/builder';\nexport type B = Builder;\n",
    expect: '@typescript-eslint/no-restricted-imports',
  },
  {
    name: 'unit tests may import @playwright/test',
    filePath: 'tests/unit/x.spec.ts',
    code: "import { test, expect } from '@playwright/test';\ntest('a', () => {\n  expect(1).toBe(1);\n});\n",
    expect: null,
  },
];

const eslint = new ESLint();
let failed = 0;

for (const c of cases) {
  const filePath = join(dirname(c.filePath), basename(c.filePath).replace(/^x/, '__verify_lint__'));
  const createdDir = mkdirSync(dirname(filePath), { recursive: true });
  let errors;
  try {
    writeFileSync(filePath, c.code);
    const [result] = await eslint.lintText(c.code, { filePath });
    errors = result.messages.filter((m) => m.severity === 2 || m.fatal);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${c.name}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  } finally {
    rmSync(createdDir ?? filePath, { recursive: true, force: true });
  }
  const ruleIds = errors.map((m) => m.ruleId ?? `fatal: ${m.message}`);
  const ok = c.expect === null ? errors.length === 0 : ruleIds.includes(c.expect);
  if (ok) {
    console.log(`PASS ${c.name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${c.name}: expected ${c.expect ?? 'no errors'}, got [${ruleIds.join(', ')}]`);
  }
}

if (failed > 0) {
  console.error(`${failed}/${cases.length} lint rule checks failed`);
  process.exit(1);
}
console.log(`${cases.length}/${cases.length} lint rule checks passed`);
