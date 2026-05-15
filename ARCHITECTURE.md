# Architecture

## Design Goals

`zap` is an agent-friendly CLI, not a scraper. Commands must be deterministic, non-interactive, parseable, and explicit about what they fetch.

## Data Sources

- Official RSS feeds: fetched and normalized by `src/rss.ts`.
- Generated handoff URLs: built by `src/urls.ts`.
- Local user state: stored in SQLite by `src/store.ts`.
- Command contracts: exposed from `src/schema.ts`.

## Command Flow

`src/cli.ts` passes `process.argv` to `runCli` in `src/app.ts`. `runCli` parses global flags, dispatches a command, selects requested fields, formats output, and converts all errors to JSON envelopes.

## Local Cache

The default cache is `~/.cache/zap-cli/zap.sqlite`, overridden by `--cache-dir` or `ZAP_CACHE_DIR`.

Tables:

- `rss_items` for normalized RSS entries.
- `rss_items_fts` for local full-text search.
- `watch_items` for local shopping shortlist entries.

## Output Contract

Machine output is JSON by default when stdout is not a TTY. NDJSON is supported for stream-like consumption. The CLI avoids ANSI formatting in machine output.

## Consent-Safe Boundary

The implementation deliberately avoids blocked or sensitive ZAP surfaces. `search url` and `product url` generate links for browser handoff, and do not fetch those pages.
