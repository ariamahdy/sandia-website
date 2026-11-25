# error:share: mask the private env values everywhere

Date: 2026-11-25. Branch: `fix/error-share-env-masking`.

## Problem

D19 masks only the page snapshot. The error message, the `Locator:` line, the call log and the expect diff stay as they are, and they quote the test data that came from the private env file: a search keyword, a dropdown label, a branch code. On 2026-11-25 two shared files carried such values in their `Error:` and `Locator:` lines. D19 accepts this ("nor is anything in the error message, so a shared file is still read before it is handed over"), but in practice nobody reads every line, so the masking is not the default it claims to be.

Constraint: the error message is the most useful part for diagnosis. The same day an expect diff showing the real popup text ("submit" instead of "update") fixed a test in one step, so the fix must not blank the error section.

## Options

| Option | Leak | Diagnosability | Cost |
|---|---|---|---|
| A. Mask every value of the private env file wherever it appears, as `<env:KEY>` | Closes the leak for every value the tests type or expect, including credentials | Keeps every app text, and the key name says which env value was involved | Reads one more file; needs a minimum length and word boundaries so short values do not eat line numbers |
| B. Mask every quoted string in the error section | Closes the leak | Loses the app texts in expect diffs (the popup text above) | Small |
| C. Drop the error section | Closes the leak | Loses the failure itself | Small |

Recommendation: A. Reason: it masks exactly the values we know are private and keeps everything else readable.

Values that A does not cover, because they never came from the env file (customer data read from the page and quoted in an error), stay covered by the snapshot rules and by the existing 6-digit rule. The "still read before it is handed over" note in D19 stays for them.

## Design

- `scripts/lib/mask.mjs`: `maskEnvValues(text, env)`, where `env` is a key/value record.
  - A value is masked when it has at least 3 characters and sits between non-alphanumeric characters or the line ends. So `K1` stays and `K12` inside `AK123` stays, but `"K12 - X"` → `"<env:KEY>"`.
  - Each value is masked whole. Each part of it split on ` - ` (the `code - name` label shape) is masked too, as `<env:KEY#1>` and `<env:KEY#2>`. A test that keys on one part, such as a row matched by its code, then leaks nothing either.
  - Longest value first, so a value that contains another one is replaced whole.
  - Returns `{ text, masked }`.
- `scripts/error-share.mjs`:
  - Reads the env files named by `--mask-env <path>` (repeatable) with `node:util` `parseEnv`, which is present on Node v26.13.1 (checked locally, `typeof parseEnv === 'function'`).
  - A missing file is skipped with a log line, so a clean worktree without `private/` still works (D25).
  - Applies `maskSnapshot`, then `maskEnvValues`. Logs `masked N values, M env values` per file.
- `package.json`: `"error:share": "node scripts/error-share.mjs --mask-env private/.env"`. The core names only the path, as `test:uat` already does. No key or value goes into the core.
- `mask:snapshot` stays snapshot-only: it masks one file by hand and has no env context. Its README line says so.

## Tasks

### Task 1: `maskEnvValues` (failing tests first)
- [ ] New `tests/unit/scripts/mask-env.spec.ts`, cases:
  - masks a value in an `Error:` line, a `Locator:` line, a diff line and a snapshot `text:` line;
  - masks each ` - ` part, also alone;
  - leaves values shorter than 3 characters;
  - leaves a value that is part of a longer word or number;
  - replaces the longest value first;
  - counts the masked occurrences;
  - an empty env leaves the text unchanged.
- [ ] `scripts/lib/mask.mjs`: `export const maskEnvValues = (text, env) => ({ text, masked })`.
- [ ] Verify: `npm run test:unit -- mask-env`.

### Task 2: `error:share` reads the env file (failing tests first)
- [ ] `tests/unit/scripts/error-share.spec.ts`:
  - a workspace with `private/.env` holding `SEARCH=Jane-0042`, `CABANG=K12 - Area X` and an error file quoting both in `Error:` and `Locator:`: the share holds neither value nor part, holds `<env:SEARCH>` and `<env:CABANG#1>`, and the stdout reports the env count;
  - without `private/.env`, the share still works and logs that the file was skipped;
  - the originals in `test-results/` stay unmasked (existing test, extended).
- [ ] `scripts/error-share.mjs`: `--mask-env` parsing, `parseEnv`, missing-file skip, both maskers.
- [ ] `package.json` `error:share` script.
- [ ] Verify: `npm run test:unit -- error-share`.

### Task 3: docs
- [ ] `docs/ARCHITECTURE.md`:
  - update D19: the error message is now masked for env values;
  - new row D26 (context: shared files leaked env values through the error message; decision: option A with the 3-character, boundary and ` - ` part rules; enforcer: `tests/unit/scripts/mask-env.spec.ts`, `tests/unit/scripts/error-share.spec.ts`).
- [ ] `README.md`: the `error:share` line says it masks the snapshot and every private env value; the `mask:snapshot` line says snapshot only.
- [ ] Verify: `npm run guard` (no private key or value in the docs).

## Commits (branch `fix/error-share-env-masking`, merge to `main` with a merge commit)
1. `feat(scripts): mask the private env values in shared error files` (Tasks 1-2)
2. `docs: record env-value masking of shared error files (D26)` (Task 3)
3. after merge: `docs: drop the executed error-share masking plan`

## Verification
- `npm run typecheck`, `npm run lint`, `npm run verify:lint`, `npm run guard`, `npm run test:unit`.
- D25: the CI quality steps in a clean worktree without `private/`:
  - `git worktree add $CLAUDE_JOB_DIR/tmp/wt fix/error-share-env-masking`;
  - `npm ci`, typecheck, lint, `verify:lint`, guard, `test:unit` there;
  - `npm run error:share` there logs the skipped env file.
- Owner, on the company laptop: run any failing UAT test, then `npm run error:share`, then search the share for one `.env` value (for example with `Select-String`). Expect no hit and `<env:...>` markers in the `Error:` and `Locator:` lines.

## Regression risk
- Over-masking: an env value equal to a common app word (a status like `Active`) is masked in app texts too. The marker names the key, so the reader still knows what stood there. Accepted.
- Under-masking: values under 3 characters, and customer data that is not in the env file, are unchanged, as today.
- Windows line endings: the masker works per match, not per line, so `\r\n` files are unaffected. One test uses `\r\n`.
