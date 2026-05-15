# Roadmap

## Current Public-Testing Milestone

- Open the GitHub repository for public community testing.
- Ship consent-safe RSS, URL generation, watchlist, schema, and local SQLite/FTS commands.
- Ship bounded `product inspect --model-id` for one explicit public product page.
- Ship `search sync`, `search local`, and `search suggest` for better offline discovery from official RSS/cache data.
- Ship first export commands for RSS and local watchlist data.
- Ship export file output and cache inspection.
- Ship first product offer ranking from explicit product-page inspection data.
- Define the self-evolving agent model as local memory, diagnostics, skill suggestions, and reviewable code proposals.
- Publish English and Hebrew README installation and usage guidance.
- Add public security policy and GitHub issue/PR templates.
- Keep docs and changelog updated with each feature branch.
- Verify JSON-first behavior for agent usage.

## v0.2

- Add richer text output for human terminals.
- Add command examples to schema output.
- Add cache maintenance commands such as prune/clear with explicit confirmation.
- Add local preference/profile commands for safe personalization.
- Add diagnostics commands that summarize errors and suggest next actions without changing code automatically.

## v0.3 Procurement Research

- Improve `product inspect` extraction only from allowed public product-page data.
- Add procurement reports from saved inspection JSON and explicit local ranking rules.
- Add Markdown/HTML renderers after JSON report schemas are stable.
- Add a reviewable skill-update workflow that proposes diffs to user-local guidance based on successful CLI usage patterns.

## v1 Community Release

- Review public testing feedback and stabilize command behavior.
- Publish release notes and npm package metadata.
- Freeze v1 command schemas and document compatibility policy.
- Consider npm publication once install, support, and schema compatibility are ready.

## Out of Scope Without Written ZAP Authorization

- Search page scraping.
- Filter/sort crawling.
- Checkout or account automation.
- Browser cookie/session extraction.
- HAR/API reverse engineering.
- Bulk indexing of catalogue pages.
