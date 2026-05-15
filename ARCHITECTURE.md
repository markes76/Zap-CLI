# Architecture

## Design Goals

`zap` is an agent-friendly CLI, not a scraper. Commands must be deterministic, non-interactive, parseable, and explicit about what they fetch.

The long-term agent model is self-improving but not silently self-modifying. The CLI can learn local preferences, record successful search/output patterns, diagnose failures, and propose skill or code updates. Any change to executable code, shared docs, or published skills should be explicit, reviewable, and user-approved.

## Data Sources

- Official RSS feeds: fetched and normalized by `src/rss.ts`.
- Explicit product pages: `src/product.ts` fetches one validated `model.aspx?modelid=<id>` page with no credentials and redirects disabled; `src/procurement.ts` ranks only offer-like data observed from that inspection.
- Export shaping: `src/export.ts` turns RSS and watchlist records into JSON envelopes, NDJSON rows, and CSV rows.
- Local search planning: `src/search.ts` expands category lists, validates search sort modes, and builds search handoff next-command hints.
- Generated handoff URLs: built by `src/urls.ts`.
- Local user state: stored in SQLite by `src/store.ts`.
- Command contracts: exposed from `src/schema.ts`.

## Command Flow

`src/cli.ts` passes `process.argv` to `runCli` in `src/app.ts`. `runCli` parses global flags, dispatches a command, selects requested fields, formats output, and converts all errors to JSON envelopes. Product inspection and offer ranking validate the model id before any network request and only fetch the canonical product page generated from that id.

## Local Cache

The default cache is `~/.cache/zap-cli/zap.sqlite`, overridden by `--cache-dir` or `ZAP_CACHE_DIR`.

Tables:

- `rss_items` for normalized RSS entries.
- `rss_items_fts` for local full-text search.
- `watch_items` for local shopping shortlist entries.

`search sync` can populate multiple official RSS categories into the same cache. `search local` and `search suggest` only read that cache and never fetch ZAP search result pages.

`cache info` opens the SQLite cache read-only, reports counts, and does not create a missing cache.

`feed export` fetches one bounded official RSS feed and formats the result for sharing. `watch export` reads only local watchlist data, does not create a missing cache, and excludes freeform notes unless `--include-notes` is provided. Export commands can write to stdout or to an exact local file path via `--out`; they do not overwrite existing files or the active cache database.

## Output Contract

Machine output is JSON by default when stdout is not a TTY. NDJSON is supported for stream-like consumption. The CLI avoids ANSI formatting in machine output.

## Adaptive Agent Loop

Future self-evolution should use four consent-safe layers:

- Local preference memory: user-owned settings for categories, budget ranges, preferred output formats, trusted vendors, language, and recurring procurement constraints.
- Run history and diagnostics: local summaries of commands, errors, warnings, result counts, and which next actions helped, without cookies, sessions, checkout data, or account identifiers.
- Skill updates: generated suggestions for `skills/zap-cli/SKILL.md` or user-local companion skill notes, presented as diffs rather than applied silently.
- Code improvement proposals: reproducible bug reports and patch suggestions that go through tests, PRs, CI, and user review before reaching `main`.

## Consent-Safe Boundary

The implementation deliberately avoids blocked or sensitive ZAP surfaces. `search url` and `product url` generate links for browser handoff and do not fetch those pages. `product inspect` and `product offers` are the only non-RSS product fetch paths; they request one public model page with `credentials: "omit"` and `redirect: "error"`, and they do not fetch search, filter, order, account, checkout, redirect, or private API endpoints. `product offers` does not infer official import, warranty, stock certainty, final checkout totals, or redirect targets.
