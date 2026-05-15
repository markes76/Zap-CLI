# PR Status

Last inspected: 2026-05-15.

## Current Pull Request

- Repository: `markes76/Zap-CLI`.
- Branch: `codex/product-offers`.
- Base: `main`.
- PR: not opened yet for this branch.
- Main already includes the bootstrap, local search expansion, stdout exports, cache inspection, and export file output.
- Live mutable metadata should be checked with `gh pr view <number> --json state,isDraft,mergeable,commits,statusCheckRollup,url` after opening the PR.

## Local Branch Status

- Local checkout is on `codex/product-offers`.
- The branch adds `product offers` ranking from one explicit product page's static offer metadata, matching schema updates, tests, and docs.
- Re-run the full local check set before marking the PR ready for review.

## PR Summary Draft

Use this concise summary if the PR body needs a hygiene update:

```markdown
## Summary
- Add `zap product offers --model-id <id>` for preliminary offer ranking from observed static product-page metadata.
- Keep official import, warranty, checkout totals, and redirect targets unspecified unless explicitly observed.
- Update command schemas, README, roadmap, architecture, scorecard, data-sharing notes, skill docs, and tests.

## Verification
- Run `pnpm test`, `pnpm check`, and `pnpm build`.
- Smoke-test schema introspection and product offers JSON output.
- Push the branch, open a PR, and confirm CI.
```

## Key Risks to Track

- The PR is still draft, so review has not established the final baseline.
- v1 release readiness depends on public-facing hygiene that is not yet present: security policy, issue templates, release notes, npm package metadata review, and schema compatibility policy.
- Future procurement work must stay inside the consent-safe boundary and should be reviewed separately unless it is tightly scoped to hardening `product inspect` or `product offers`.
- Integration coverage currently depends on bounded official RSS access; keep timeouts and limits conservative.

## Recommended Next PR Actions

- Keep the current PR focused on product offer ranking, schemas, tests, and matching docs.
- Confirm the current check set still passes before merge: `pnpm test`, `pnpm check`, and `pnpm build`.
- Update the PR body if any new behavior or known limitation changes before review.
- Merge only after CI is green.
- Open separate branches for richer text output, schema examples, product inspection hardening, saved-inspection inputs, cache maintenance, and procurement reports.
