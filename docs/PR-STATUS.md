# PR Status

Last inspected: 2026-05-16.

## Current Pull Request

- Repository: `markes76/Zap-CLI`.
- Branch: `codex/command-reference`.
- Base: `main`.
- PR: not opened yet for this branch.
- Main already includes the bootstrap, local search expansion, exports, cache inspection, product offer ranking, and adaptive-agent feedback loop.
- Live mutable metadata should be checked with `gh pr view <number> --json state,isDraft,mergeable,commits,statusCheckRollup,url` after opening the PR.

## Local Branch Status

- Local checkout is on `codex/command-reference`.
- The branch adds a detailed command reference for every public command and links it from the README.
- Re-run the full local check set before marking the PR ready for review.

## PR Summary Draft

Use this concise summary if the PR body needs a hygiene update:

```markdown
## Summary
- Add `docs/COMMANDS.md` explaining every public command with purpose, examples, outputs, and safety notes.
- Link the command reference from the README and changelog.
- Confirm the documented command list matches `zap schema list`.

## Verification
- Run `pnpm test`, `pnpm check`, and `pnpm build`.
- Smoke-test schema introspection and representative documented commands.
- Push the branch, open a PR, and confirm CI.
```

## Key Risks to Track

- The PR is still draft, so review has not established the final baseline.
- v1 release readiness depends on public-facing hygiene that is not yet present: security policy, issue templates, release notes, npm package metadata review, and schema compatibility policy.
- Future procurement and adaptive-agent work must stay inside the consent-safe boundary and should be reviewed separately unless it is documentation-only.
- Integration coverage currently depends on bounded official RSS access; keep timeouts and limits conservative.

## Recommended Next PR Actions

- Keep the current PR focused on command documentation and repository readiness.
- Confirm the current check set still passes before merge: `pnpm test`, `pnpm check`, and `pnpm build`.
- Update the PR body if any new behavior or known limitation changes before review.
- Merge only after CI is green.
- Open separate branches for richer text output, schema examples, product inspection hardening, saved-inspection inputs, cache maintenance, procurement reports, and public-release packaging.
