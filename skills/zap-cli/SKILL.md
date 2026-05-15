---
name: zap-cli
description: Use when helping a user or agent find products on zap.co.il with ZAP CLI, compare consent-safe known data, generate handoff URLs, manage local watchlists, or plan procurement research.
---

# ZAP CLI

## Overview

Use `zap` as a consent-safe shopping research CLI for ZAP. It is authoritative for official RSS items, local cache/search state, generated handoff URLs, local watchlists, bounded product-page inspection, and command schemas. It is not a general scraper and does not verify checkout state or account-specific data.

For agent workflows, request JSON explicitly:

```bash
zap schema list --output json
```

From this source repo, use `pnpm dev -- ...` or `pnpm exec tsx src/cli.ts ...` during development. After `pnpm build`, use `node dist/cli.js ...`. For installed usage, use `zap ...`.

## Safe Command Surface

Confirm current commands with schema before relying on a command that may have changed:

```bash
zap schema list --output json
zap schema get feed-search --output json
zap about --output json
```

Current schema-backed commands:

| Command | Safe use |
| --- | --- |
| `about` | Show purpose, sources, and safety policy. No ZAP page fetch. |
| `categories list` | List static RSS category metadata. |
| `feed list --category <id> --limit <n>` | Fetch one bounded official RSS category feed. |
| `feed sync --category <id> --limit <n>` | Fetch one bounded official RSS category feed and cache normalized items locally. |
| `feed search <query> --limit <n>` | Search local SQLite FTS cache only. No ZAP network request. |
| `feed export --category <id> --limit <n> --output json|ndjson|csv` | Export one bounded official RSS feed. |
| `search sync --category <id|all|comma-list> --limit <n>` | Fetch bounded official RSS feeds and populate the local cache. |
| `search local <query> --category <id|comma-list> --sort relevance|newest` | Search local cache only with optional filters. |
| `search suggest <query>` | Return local cache candidates plus a generated ZAP search handoff URL. |
| `product url --model-id <id>` | Generate product/reviews/compare URLs only. Does not fetch them. |
| `product inspect --model-id <id>` | Fetch one validated public product page and extract static JSON-LD/product metadata. |
| `search url <query>` | Generate official search handoff URL with `fetched: false`. Does not fetch blocked search pages. |
| `watch add/list/remove` | Manage local SQLite watchlist items. |
| `watch export --output json|csv [--include-notes]` | Export local watchlist data. Notes are excluded unless requested. |
| `schema list/get` | Read offline command contracts. |

Confirm details with `zap schema get product-inspect --output json` before relying on field-level behavior.

## Consent Boundary

Allowed by the current CLI:

- Fetch official RSS feeds under `https://www.zap.co.il/xmls/general/rss.aspx`.
- Fetch one explicit public product page generated from a validated numeric model id: `https://www.zap.co.il/model.aspx?modelid=<id>`.
- Search local SQLite/FTS cache created from those RSS feeds.
- Generate ZAP product/search/review/compare handoff URLs.
- Store and read local watchlists.
- Read local schema/about metadata.

Do not use the CLI, browser automation, or improvised scripts to fetch or scrape blocked search, filter, sort, order, account, checkout, redirect, tracking, private API, cookie/session, HAR, or auth-replay flows. Generated URLs are links for the user or an explicitly authorized browser session; they are not fetched facts.

## Output Expectations

- `--output json|text|ndjson` and `-o json|text|ndjson` are supported.
- Export commands support command-specific CSV output: `feed export --output csv` and `watch export --output csv`.
- On export commands, `--select` filters exported item/row fields while preserving JSON envelope metadata.
- When stdout is not a TTY, the default output is JSON. In an interactive terminal, the default is text.
- Use `--output json` for agent parsing. JSON and NDJSON contain no ANSI formatting.
- `--output ndjson` emits one JSON line per array item; object wrappers such as `{ "commands": [...] }` remain a single JSON line.
- `--select id,title,modelId,productUrl` selects top-level fields. It is most useful for array results like `feed list`, not nested wrappers like `schema list`.
- `--quiet` suppresses successful stdout. Errors still use JSON on stderr.
- Errors always use a JSON envelope on stderr and exit with stable codes, for example `INVALID_ARGUMENTS` exits `2`, `NOT_FOUND` exits `5`, `NETWORK_ERROR` exits `7`, and `REMOTE_API_ERROR` exits `8`.

Error shape:

```json
{ "error": { "code": "INVALID_ARGUMENTS", "message": "...", "hint": "..." } }
```

## Finding Products Safely

Start with categories:

```bash
zap categories list --output json
```

Fetch current official RSS candidates without touching blocked search pages:

```bash
zap feed list --category electric --limit 20 --output json
zap feed list --category electric --limit 20 --select id,title,modelId,productUrl --output json
zap feed export --category electric --limit 20 --output ndjson
zap feed export --category electric --limit 20 --output csv
```

Build a reusable local cache and search it offline:

```bash
zap feed sync --category electric --limit 50 --output json
zap feed search "Wiim" --limit 10 --output json
zap feed search "iphone" --limit 10 --select id,title,modelId,productUrl --output json
```

For broader RSS-backed discovery, sync several categories and use the `search` namespace:

```bash
zap search sync --category electric,comp --limit 50 --output json
zap search sync --category all --limit 10 --output json
zap search local "iphone 17" --category electric --sort relevance --limit 10 --output json
zap search suggest "iphone 17 pro max" --limit 5 --output json
```

`search suggest` returns local cache results, a `cacheStatus` of `searched`, `empty`, or `unavailable`, and a generated ZAP search URL with `fetched: false`; it does not fetch the search page. Its `nextCommands` are structured `argv` arrays, not shell strings, so preserve them as arrays when handing work to another agent or process.

If local RSS results are empty or too broad, generate a handoff URL instead of pretending to scrape search results:

```bash
zap search url "iphone 17" --output json
```

Expected handoff shape:

```json
{ "query": "iphone 17", "searchUrl": "https://www.zap.co.il/search.aspx?keyword=iphone+17", "fetched": false }
```

For a known model id, generate links:

```bash
zap product url --model-id 1253558 --output json
```

Expected shape:

```json
{
  "modelId": "1253558",
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "reviewsUrl": "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
  "compareUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
}
```

Inspect one explicit public product page when the user needs product-page evidence:

```bash
zap product inspect --model-id 1253558 --output json
```

Expected top-level fields:

```json
{
  "sourceUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "fetchedAt": "2026-05-15T00:00:00.000Z",
  "modelId": "1253558",
  "title": "Product title when available",
  "jsonLdProduct": {},
  "aggregateOffer": {},
  "links": {
    "canonicalUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "reviewsUrl": "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
    "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
  },
  "vendorCards": [],
  "warnings": []
}
```

Treat `vendorCards` as opportunistic static metadata. If it is empty or a warning is present, ask for browser/user confirmation before ranking offers.

## Watchlists

Watchlists are local user state. They do not monitor live prices unless the user later supplies observations or a future command adds that capability.

```bash
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17" --notes "wait for sale" --output json
zap watch list --output json
zap watch export --output json
zap watch export --output csv --include-notes
zap watch remove --id <watch-id> --output json
```

`watch export` excludes freeform notes by default and sets `notesIncluded: false`. Use `--include-notes` only when the notes are safe to share.

Watch item shape:

```json
{
  "id": "<uuid>",
  "modelId": "1253558",
  "title": "iPhone 17",
  "targetPriceIls": 2500,
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
  "notes": "wait for sale",
  "createdAt": "2026-05-15T00:00:00.000Z"
}
```

Default cache path is `~/.cache/zap-cli/zap.sqlite`. Override with `--cache-dir <path>` or `ZAP_CACHE_DIR`.

## Procurement Guidance

When helping a user choose what to buy, keep evidence labels explicit:

- **Verified by CLI**: output from `about`, `categories list`, `feed list`, `feed sync`, `feed search`, `product url`, `product inspect`, `search url`, `watch *`, or `schema *`.
- **Browser/user observed**: model page details, vendor names, prices, shipping, warranty, stock, ratings, screenshots, or copied text supplied by the user or observed in an authorized browser session.
- **Inference**: reasoning from the verified and observed data.

Use this workflow:

1. Clarify the product need, budget, constraints, and whether the user wants Hebrew/ZAP-specific results.
2. Use `categories list`, `feed list`, and optionally `feed sync`/`feed search` to find RSS-backed candidates.
3. Use `search sync` and `search local` when the user needs multi-category offline discovery.
4. Use `search suggest` or `search url` for broader discovery handoff when RSS/local cache is insufficient.
5. Use `product inspect` once a model id is known to collect static product-page evidence. Use `product url` for handoff links.
6. Recommend only from labeled evidence. Do not infer current price, seller quality, stock, shipping, warranty, or import status from RSS titles or generated URLs alone.
7. Use `watch add` to save shortlisted model ids and target prices locally.

Good wording:

- "The CLI RSS cache found these model candidates."
- "This is a generated ZAP search URL; I have not fetched the search page."
- "I need the model page details or your screenshot before ranking live offers."

Avoid wording that claims the CLI scraped, inspected, monitored, or verified blocked ZAP flows.

## Failure Handling

- `feed search` returns `[]` on a new or empty cache; run `feed sync` for relevant categories first.
- `search local` returns `[]` on a new or empty cache; run `search sync --category <id|all>` first.
- `feed list` and `feed sync` may return zero items if the RSS feed is empty or items cannot be normalized to model ids.
- Invalid or missing model ids produce `INVALID_ARGUMENTS`; model ids must be numeric, for example `1253558`.
- Network failures apply to official RSS fetches and explicit product inspection. Fall back to generated handoff URLs and user-provided model details when ZAP is unavailable.

## Current Limitations

- No supported command verifies checkout state, current stock, final delivery estimates, warranty terms, import status, or account-specific pricing.
- No supported command fetches ZAP search/filter/sort/order/account/checkout/redirect pages.
- `product url` and `search url` generate URLs only.
- Local watchlists store targets and notes; they do not verify price changes.
