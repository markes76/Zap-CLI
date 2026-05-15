# Command Reference

This file explains every public `zap` command. The canonical machine-readable contracts are still available from:

```bash
zap schema list --output json
zap schema get <command-key> --output json
```

All commands are non-interactive. JSON is the safest format for agents and scripts. Errors always use the JSON envelope documented in the README.

## Global Flags

| Flag | Meaning |
| --- | --- |
| `--output json|text|ndjson` | Selects output format for normal commands. Export commands have narrower format sets documented below. |
| `-o json|text|ndjson` | Short form for `--output`. |
| `--quiet` or `-q` | Suppresses successful stdout. Errors still print JSON on stderr. |
| `--timeout <seconds>` | Bounds network fetches. Applies to RSS fetches and explicit product-page fetches. |
| `--cache-dir <path>` | Uses a custom local cache directory instead of `~/.cache/zap-cli`. |
| `--select a,b,c` | Selects top-level fields. For export envelopes it filters item rows while preserving envelope metadata. |
| `--no-color` | Reserved for terminal output compatibility. Machine output does not use ANSI color. |

## Metadata Commands

### `zap about`

Shows project purpose, source links, and the consent-safe boundary.

Use this when you want a compact summary of what the CLI is allowed to do before running shopping commands.

```bash
zap about --output json
```

Output: project metadata, safety policy, and primary source references.

Safety: offline metadata only. It does not fetch ZAP pages.

### `zap categories list`

Lists the supported official RSS top-level categories.

Use this before `feed list`, `feed sync`, or `search sync` when you need a valid `--category` value.

```bash
zap categories list --output json
```

Output: category ids, Hebrew names, English names, and official RSS URLs.

Safety: static CLI metadata based on ZAP's public RSS page.

### `zap cache info`

Inspects the local SQLite cache without mutating it.

Use this to check whether RSS items, watchlist items, and cached categories exist before searching locally.

```bash
zap cache info --output json
zap cache info --cache-dir ./tmp-cache --output json
```

Output: cache path, `exists`, `readable`, RSS count, watch count, and per-category RSS counts.

Safety: local read-only. If the cache is missing, the command does not create it.

## Adaptive Agent Commands

Adaptive-agent commands are local-only. They let the CLI learn explicit preferences and feedback, then produce reviewable suggestions. They do not fetch ZAP, upload data, or rewrite code/skill files.

### `zap agent profile get`

Shows locally stored adaptive-agent preferences.

```bash
zap agent profile get --output json
```

Output: cache path and preference records.

Safety: local read-only. A missing cache is not created.

### `zap agent profile set`

Stores one explicit local preference.

Common keys:

| Key | Example value | Meaning |
| --- | --- | --- |
| `preferred.output` | `json` | Preferred output format for examples and handoffs. |
| `preferred.category` | `electric` | Default category to try when the user has not specified one. |
| `budget.maxIls` | `4500` | Default budget ceiling in Israeli shekels. |

```bash
zap agent profile set --key preferred.output --value json --output json
zap agent profile set --key budget.maxIls --value 4500 --output json
```

Output: saved key, value, and update timestamp.

Safety: local SQLite write only. It does not update shared docs, skills, or code.

### `zap agent profile unset`

Removes one local preference.

```bash
zap agent profile unset --key preferred.output --output json
```

Output: preference key and `removed` status.

Safety: local SQLite write only. It does not fetch ZAP.

### `zap agent feedback add`

Records explicit feedback about a command result.

Use this after a useful or poor result so future suggestions can adapt to the user's preferred workflows.

```bash
zap agent feedback add --command "product offers" --rating 5 --output-format json --notes "ranked output was useful" --output json
```

Output: feedback id, command, rating, output format, optional notes, and timestamp.

Safety: local SQLite write only. Feedback is user-provided and is never sent to ZAP.

### `zap agent feedback list`

Lists recent local feedback records.

```bash
zap agent feedback list --limit 20 --output json
```

Output: cache path and recent feedback rows.

Safety: local read-only. A missing cache is not created.

### `zap agent suggest`

Summarizes preferences and feedback into recommendations.

Use this when deciding how the CLI should tailor future examples, defaults, and next-command suggestions.

```bash
zap agent suggest --output json
```

Output: cache path, preferences, feedback summary, recommendations, and a reviewable skill draft.

Safety: local read-only. Suggestions are not applied automatically.

### `zap agent skill draft`

Drafts Markdown lines that can be reviewed before updating a local skill or project guidance.

```bash
zap agent skill draft --output json
```

Output: cache path, `format=markdown`, and draft lines.

Safety: local read-only. It does not write `skills/zap-cli/SKILL.md` or any user skill file.

## RSS Feed Commands

### `zap feed list`

Fetches one bounded official ZAP RSS category feed and returns normalized items.

```bash
zap feed list --category electric --limit 20 --output json
zap feed list --category electric --limit 5 --select id,title,modelId,productUrl --output json
```

Output item shape: `id`, `title`, `descriptionText`, `category`, `publishedAt`, `modelId`, `productUrl`, `imageUrl`.

Safety: fetches only `https://www.zap.co.il/xmls/general/rss.aspx?cat=<category>` with credentials omitted and redirects disabled.

### `zap feed sync`

Fetches one bounded official RSS category feed and writes normalized items to the local SQLite/FTS cache.

```bash
zap feed sync --category electric --limit 20 --output json
```

Output: category, synced count, and cache path.

Safety: official RSS fetch plus local cache write only.

### `zap feed search`

Searches the local RSS cache with SQLite FTS.

```bash
zap feed search Wiim --limit 10 --output json
```

Output: cached RSS items matching the query.

Safety: offline local search. It does not fetch ZAP.

### `zap feed export`

Exports one bounded official RSS category feed in a shareable format.

```bash
zap feed export --category electric --limit 20 --output json
zap feed export --category electric --limit 20 --output ndjson
zap feed export --category electric --limit 20 --output csv
zap feed export --category electric --limit 20 --output csv --out exports/feed.csv
```

Output:

- `json`: envelope with schema version, record type, category, source URL, provenance, and items.
- `ndjson`: one JSON row per RSS item with provenance fields.
- `csv`: flat scalar rows with provenance fields.
- With `--out`: writes the exact file path and returns a JSON status object.

Safety: fetches only official RSS. `--out` does not overwrite existing files or the active cache database.

## Search Commands

### `zap search url`

Generates a ZAP search handoff URL without fetching it.

```bash
zap search url "iphone 17" --output json
```

Output: query, search URL, and `fetched: false`.

Safety: does not fetch search pages, filters, sort pages, or result pages.

### `zap search sync`

Fetches bounded official RSS feeds and caches them locally for offline search.

```bash
zap search sync --category electric,comp --limit 20 --output json
zap search sync --category all --limit 10 --output json
```

Output: synced categories, per-category counts, total synced count, and cache path.

Safety: fetches only official RSS category feeds and writes local cache data.

### `zap search local`

Searches cached RSS items with optional category filtering and deterministic sorting.

```bash
zap search local "iphone 17" --category electric --sort relevance --limit 10 --output json
zap search local Wiim --sort newest --limit 10 --output json
```

Output: cached RSS items matching the query.

Safety: offline local search. It does not fetch ZAP search pages.

### `zap search suggest`

Returns local cached candidates plus a generated ZAP search URL and structured next-command hints.

```bash
zap search suggest "iphone 17 pro max" --category electric --limit 5 --output json
```

Output: query, handoff URL, cache status, cache results, optional cache warnings, and next command `argv` arrays.

Safety: local cache access only. It never fetches ZAP search pages.

## Product Commands

### `zap product url`

Generates canonical product handoff URLs from a numeric model id.

```bash
zap product url --model-id 1253558 --output json
```

Output: model id, product URL, reviews URL, and comparison/spec URL.

Safety: URL generation only. It does not fetch ZAP.

### `zap product inspect`

Fetches one explicit public product page and extracts conservative static metadata.

```bash
zap product inspect --model-id 1253558 --output json
```

Output: source URL, fetched timestamp, model id, title, JSON-LD Product fields, AggregateOffer summary/offers when present, safe inferred links, static vendor-card metadata when reliable, and warnings.

Safety: validates the model id first, then fetches only `https://www.zap.co.il/model.aspx?modelid=<id>` with credentials omitted and redirects disabled. It does not fetch search, filter, account, checkout, redirect, private API, or hidden API endpoints.

### `zap product offers`

Ranks offer-like metadata observed on one explicit product page.

```bash
zap product offers --model-id 1253558 --limit 20 --output json
```

Output: `zap.product-offers.v1` envelope with source product metadata, ranking policy, ranked offers, and warnings.

Ranking policy:

- Lower price wins first.
- Higher vendor rating breaks price ties.
- Higher review count breaks rating ties.
- Static vendor cards are preferred over JSON-LD offers when all ranking fields tie.

Safety: fetches the same single validated product page as `product inspect`. It ranks only observed static vendor cards and JSON-LD offers. It does not infer official import, warranty, stock certainty, final checkout totals, or vendor redirect targets.

## Watchlist Commands

### `zap watch add`

Adds a local watchlist item.

```bash
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17" --notes "wait for sale" --output json
```

Output: created watch item with id, model id, title, target price, product/spec URLs, notes, and timestamp.

Safety: local SQLite write only. It validates the model id and generates handoff URLs without fetching ZAP.

### `zap watch list`

Lists local watchlist items.

```bash
zap watch list --output json
```

Output: watch items ordered by creation time descending.

Safety: offline local read.

### `zap watch export`

Exports local watchlist items.

```bash
zap watch export --output json
zap watch export --output csv
zap watch export --output csv --include-notes
zap watch export --output json --out exports/watch.json
```

Output:

- `json`: envelope with schema version, record type, provenance, `notesIncluded`, and items.
- `csv`: flat watch rows.
- With `--include-notes`: includes freeform local notes.
- With `--out`: writes the exact file path and returns a JSON status object.

Safety: offline local read. A missing watchlist cache is not created. Notes are excluded unless explicitly requested. `--out` does not overwrite existing files or the active cache database.

### `zap watch remove`

Removes one local watchlist item by id.

```bash
zap watch remove --id <watch-id> --output json
```

Output: id and `removed` status.

Safety: local SQLite delete only.

## Schema Commands

### `zap schema list`

Lists command schemas.

```bash
zap schema list --output json
```

Output: command key, name, and description for each supported command.

Safety: offline metadata.

### `zap schema get`

Shows one command schema.

```bash
zap schema get product-offers --output json
zap schema get "agent suggest" --output json
```

Output: key, name, description, usage, output contract, and safety statement for one command.

Safety: offline metadata.

## Pre-Public Test Checklist

Before making the repo public, run:

```bash
pnpm test
pnpm check
pnpm build
node dist/cli.js schema list --output json
node dist/cli.js about --output json
node dist/cli.js categories list --output json
node dist/cli.js cache info --cache-dir /tmp/zap-cli-public-test --output json
node dist/cli.js search url "iphone 17" --output json
node dist/cli.js product url --model-id 1253558 --output json
node dist/cli.js agent profile get --cache-dir /tmp/zap-cli-public-test --output json
```

Network smoke tests should stay bounded:

```bash
node dist/cli.js feed list --category electric --limit 2 --timeout 10 --output json
node dist/cli.js product inspect --model-id 1253558 --timeout 10 --output json
node dist/cli.js product offers --model-id 1253558 --limit 5 --timeout 10 --output json
```
