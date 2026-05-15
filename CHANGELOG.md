# Changelog

## Unreleased

- Added `search sync` for bounded multi-category official RSS cache population.
- Added `search local` for offline cache search with optional category filter and sort mode.
- Added `search suggest` for local candidates plus generated ZAP search handoff URLs.
- Added `feed export` for JSON, NDJSON, and CSV exports from bounded official RSS feeds.
- Added `watch export` for JSON and CSV local watchlist exports, with notes excluded unless `--include-notes` is used.

## 0.1.0 - Private Bootstrap

- Added TypeScript CLI scaffold with `zap` binary.
- Added RSS parsing/fetching for official ZAP RSS category feeds.
- Added local SQLite/FTS sync and offline feed search.
- Added local watchlist commands.
- Added product/search URL generation without fetching blocked pages.
- Added bounded `product inspect --model-id` for one explicit public product page.
- Added command schema introspection.
- Added tests, docs, and CI-ready scripts.
- Added agent recon notes and a draft `zap-cli` usage skill.
- Added next-step, PR-status, and data-sharing/export design docs.
