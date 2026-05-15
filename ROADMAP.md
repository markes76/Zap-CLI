# Roadmap

## Current Private Milestone

- Bootstrap private GitHub repository.
- Ship consent-safe RSS, URL generation, watchlist, schema, and local SQLite/FTS commands.
- Ship bounded `product inspect --model-id` for one explicit public product page.
- Ship `search sync`, `search local`, and `search suggest` for better offline discovery from official RSS/cache data.
- Ship first export commands for RSS and local watchlist data.
- Ship export file output and cache inspection.
- Keep docs and changelog updated with each feature branch.
- Verify JSON-first behavior for agent usage.

## v0.2

- Add richer text output for human terminals.
- Add command examples to schema output.
- Add cache maintenance commands such as prune/clear with explicit confirmation.

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
