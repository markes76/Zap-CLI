# Roadmap

## Current Private Milestone

- Bootstrap private GitHub repository.
- Ship consent-safe RSS, URL generation, watchlist, schema, and local SQLite/FTS commands.
- Ship bounded `product inspect --model-id` for one explicit public product page.
- Keep docs and changelog updated with each feature branch.
- Verify JSON-first behavior for agent usage.

## v0.2

- Add richer text output for human terminals.
- Add `zap feed export --output ndjson`.
- Add cache inspection commands.
- Add command examples to schema output.
- Expand local search with deterministic ranking over official RSS/cache data.
- Add first export commands for RSS and watchlist data.

## v0.3 Procurement Research

- Improve `product inspect` extraction only from allowed public product-page data.
- Add procurement reports from saved inspection JSON and local ranking rules.
- Add Markdown/HTML renderers after JSON report schemas are stable.

## v1 Community Release

- Make the repository public after review.
- Add community issue templates and security policy.
- Publish release notes and npm package metadata.
- Freeze v1 command schemas and document compatibility policy.

## Out of Scope Without Written ZAP Authorization

- Search page scraping.
- Filter/sort crawling.
- Checkout or account automation.
- Browser cookie/session extraction.
- HAR/API reverse engineering.
- Bulk indexing of catalogue pages.
