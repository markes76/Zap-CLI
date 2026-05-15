# Next Steps

Last inspected: 2026-05-16.

This document tracks recommended project phases after the private bootstrap PR. It is intentionally focused on release hygiene and should not replace the implementation roadmap in `ROADMAP.md`.

## Current Position

- Branch: `codex/command-reference`.
- Base branch: `main`.
- Main already includes the private bootstrap, offline search expansion, product URL/inspection/offers, watchlist, cache inspection, export commands, and adaptive-agent feedback loop.
- Current branch adds a detailed command reference and README link so every public command is explained before public testing.

## Recommended Phases

### Phase 0: Command Reference PR Closure

Goal: finish private documentation readiness before broader user testing.

- Keep the scope to command explanations, README links, changelog, and PR status hygiene.
- Confirm the documented command list matches `zap schema list`.
- Run the full local gate and representative CLI smoke checks.
- Merge only after the local gate and CI are green and the PR body reflects shipped behavior.

### Phase 1: Product Inspection Hardening

Goal: make the new explicit model-page inspection command reliable enough for procurement workflows.

- Verify `product inspect --model-id` against a small set of known model ids and document observed field coverage.
- Keep extraction conservative: JSON-LD, canonical links, static page metadata, and only reliable static vendor-card attributes.
- Add focused tests for malformed JSON-LD, missing AggregateOffer, redirect failures, and timeout behavior.
- Decide whether `compareUrl` should be renamed or aliased to `specUrl` across public output before v1 schema freeze.

### Phase 2: Human Output and Export Polish

Goal: improve usability without changing the consent boundary.

- Add richer text output for human terminals while preserving JSON/NDJSON defaults for agent usage.
- Add command examples to schema output.
- Add explicit overwrite controls only if there is a clear user need; current `--out` never overwrites.
- Update command schemas, tests, CLI smoke checks, and docs in the same PR as each behavior change.

### Phase 2.5: Adaptive Agent Foundation

Goal: let the CLI learn from use while keeping changes explicit and reviewable.

- Harden local preference/profile commands for category, budget, output format, language, and vendor preferences.
- Expand diagnostic summaries for command failures, warnings, and recurring next actions.
- Expand skill-update proposal output into diffs or Markdown recommendations, not automatic overwrites.
- Keep all learning data local by default and exclude cookies, sessions, account data, checkout state, and personal identifiers.

### Phase 3: Local Search Expansion

Goal: make local search useful from bounded, official inputs.

- Add `search sync`, `search local`, and `search suggest`.
- Keep ranking deterministic and local.
- Store normalized fields needed for local filtering, such as brand, normalized title, attributes, sync time, and source URLs.
- Avoid offer ranking from RSS data unless the source reliably provides complete offer details.

### Phase 4: Procurement Ranking and Vendor Summaries

Goal: expand procurement workflows without leaving the explicit product-page boundary.

- Harden `product offers` against more product-page shapes and add `--from-inspection` only after saved inspection schemas are stable.
- Add `procure rank` over saved inspection/offer data when the ranking contract is ready.
- Add `product specs` if specs can be fetched within the approved boundary.
- Add `vendor inspect --summary-only` for bounded vendor profile summaries.
- Keep ranking criteria visible in output so agents can explain why a result won.

### Phase 5: v1 Community Release

Goal: prepare the private repo for a public, supportable v1.

- Freeze v1 command schemas and document compatibility expectations.
- Add community issue templates and a security policy.
- Review public README, architecture, roadmap, changelog, and package metadata for accuracy.
- Prepare release notes and npm publishing metadata.
- Make the repository public only after the consent boundary, docs, tests, and support policy are reviewed.

## Acceptance Gates Before v1

- `pnpm test:unit`, `pnpm test:integration`, `pnpm check`, and `pnpm build` pass locally and in CI.
- CLI smoke checks cover schema listing, schema lookup, product URL generation, search URL generation, feed listing, bounded feed sync/search, watchlist add/list/remove, selected fields, NDJSON output, and JSON error envelopes.
- Integration tests stay bounded to official RSS feeds with small limits and timeouts.
- Command schemas are frozen for v1, documented, and covered by tests.
- Output contracts are stable: JSON defaults for piped stdout, NDJSON is line-delimited, errors are JSON on stderr, and `--quiet` does not hide machine-readable failures.
- Consent-safe boundaries are reviewed: official RSS fetches only unless a later public surface is explicitly approved; blocked search, filter, account, checkout, redirect, tracking, private API, cookie, session, and HAR-derived workflows remain out of scope.
- Local data behavior is documented, including cache location, `--cache-dir`, `ZAP_CACHE_DIR`, watchlist storage, and any migration expectations.
- Public documentation is consistent across README, roadmap, architecture, changelog, scorecard, and skill docs.
- Security policy, issue templates, license, package metadata, npm files, and release notes are ready for public use.
- A fresh clone can install, test, build, and run the documented examples on the supported Node version.

## Branch and PR Hygiene Rules

- Keep feature branches small and named by purpose, for example `codex/search-local` or `codex/product-inspect`.
- Do not mix hygiene-only documentation updates with behavior changes unless the docs describe the same behavior change.
- Keep each PR body current with summary, safety notes, verification commands, and known limitations.
- Run the relevant local verification commands before requesting review; for shared behavior, run the full gate set.
- Keep CI green before merge. If CI fails, update the PR status before adding unrelated work.
- Avoid force-pushing after review starts unless coordination is explicit in the PR.
- Do not rewrite or revert another contributor's work without confirming intent.
- When a branch touches command behavior, update schemas, tests, docs, and smoke checks in the same branch.
- Use follow-up PRs for roadmap expansion. Do not let bootstrap PR #1 become the long-lived place for every v0.2 or v1 item.
