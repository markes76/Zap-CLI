# Architecture

## Design Goals

`zap` is an agent-friendly CLI, not a scraper. Commands must be deterministic, non-interactive, parseable, and explicit about what they fetch.

## Data Sources

- Official RSS feeds: fetched and normalized by `src/rss.ts`.
- Explicit product pages: `src/product.ts` fetches one validated `model.aspx?modelid=<id>` page with no credentials and redirects disabled.
- Local search planning: `src/search.ts` expands category lists, validates search sort modes, and builds search handoff next-command hints.
- Generated handoff URLs: built by `src/urls.ts`.
- Local user state: stored in SQLite by `src/store.ts`.
- Command contracts: exposed from `src/schema.ts`.

## Command Flow

`src/cli.ts` passes `process.argv` to `runCli` in `src/app.ts`. `runCli` parses global flags, dispatches a command, selects requested fields, formats output, and converts all errors to JSON envelopes. Product inspection validates the model id before any network request and only fetches the canonical product page generated from that id.

## Local Cache

The default cache is `~/.cache/zap-cli/zap.sqlite`, overridden by `--cache-dir` or `ZAP_CACHE_DIR`.

Tables:

- `rss_items` for normalized RSS entries.
- `rss_items_fts` for local full-text search.
- `watch_items` for local shopping shortlist entries.

`search sync` can populate multiple official RSS categories into the same cache. `search local` and `search suggest` only read that cache and never fetch ZAP search result pages.

## Output Contract

Machine output is JSON by default when stdout is not a TTY. NDJSON is supported for stream-like consumption. The CLI avoids ANSI formatting in machine output.

## Consent-Safe Boundary

The implementation deliberately avoids blocked or sensitive ZAP surfaces. `search url` and `product url` generate links for browser handoff and do not fetch those pages. `product inspect` is the only non-RSS product fetch path; it requests one public model page with `credentials: "omit"` and `redirect: "error"`, and it does not fetch search, filter, order, account, checkout, redirect, or private API endpoints.
