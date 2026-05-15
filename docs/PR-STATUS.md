# PR Status

Last inspected: 2026-05-16.

## Current Pull Request

- Repository: `markes76/Zap-CLI`.
- Branch: `codex/public-readme`.
- Base: `main`.
- PR: not opened yet for this branch.
- Main already includes the bootstrap, local search expansion, exports, cache inspection, product offer ranking, adaptive-agent feedback loop, and full command reference.
- Live mutable metadata should be checked with `gh pr view <number> --json state,isDraft,mergeable,commits,statusCheckRollup,url` after opening the PR.

## Local Branch Status

- Local checkout is on `codex/public-readme`.
- The branch prepares the repository for public testing with a bilingual README, security policy, GitHub issue/PR templates, and public package metadata.
- Re-run the full local check set before marking the PR ready for review.

## PR Summary Draft

Use this concise summary if the PR body needs a hygiene update:

```markdown
## Summary
- Add English and Hebrew README installation, usage, safety, local-data, and development guidance.
- Add `SECURITY.md`, GitHub issue templates, a PR template, and public package metadata.
- Update roadmap, next-step, PR-status, and changelog language for public community testing.

## Verification
- Run `pnpm test`, `pnpm check`, and `pnpm build`.
- Smoke-test representative documented commands and packaging.
- Push the branch, open a PR, and confirm CI.
```

## Key Risks to Track

- The repository should be made public only after this branch is merged and the final visibility command is verified.
- v1 release readiness still depends on release notes, npm package review, schema compatibility policy, and community testing feedback.
- Future procurement and adaptive-agent work must stay inside the consent-safe boundary and should be reviewed separately unless it is documentation-only.
- Integration coverage currently depends on bounded official RSS access; keep timeouts and limits conservative.

## Recommended Next PR Actions

- Keep the current PR focused on public-readiness documentation and repository hygiene.
- Confirm the current check set still passes before merge: `pnpm test`, `pnpm check`, and `pnpm build`.
- Update the PR body if any new behavior or known limitation changes before review.
- Merge only after CI is green.
- After merge, change repository visibility to public and verify it with `gh repo view`.
- Open separate branches for richer text output, schema examples, product inspection hardening, saved-inspection inputs, cache maintenance, procurement reports, and v1 release packaging.
