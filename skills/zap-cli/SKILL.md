---
name: zap-cli
description: Use when helping a user or agent find products on zap.co.il with ZAP CLI, compare consent-safe known data, generate handoff URLs, manage local watchlists, or plan procurement research.
---

# ZAP CLI

## Overview

Use `zap` as a consent-safe shopping research CLI for ZAP. Treat it as a deterministic source for official RSS items, local cache/search state, schema metadata, URL handoffs, and local watchlists. It is not a scraper and does not verify live offers, vendors, inventory, checkout state, or account-specific data.

Prefer JSON for agent workflows:

```bash
zap schema list --output json
```

When running from the source repo instead of an installed binary, use `pnpm exec tsx src/cli.ts ...` during development or `node dist/cli.js ...` after `pnpm build`.

## When to Use

Use this skill when the task involves:

- Finding product candidates from official ZAP RSS categories.
- Comparing safe known data from RSS/local cache results.
- Generating ZAP search or product handoff URLs for a user to open.
- Building or reviewing a local buying watchlist.
- Planning procurement research while keeping verified CLI data separate from browser or user-supplied observations.

Do not use it to automate ZAP account flows, checkout, private APIs, or blocked pages.

## Safety Boundary

Allowed surfaces:

- Official RSS feeds under `https://www.zap.co.il/xmls/general/rss.aspx`.
- Local SQLite cache and full-text search.
- Generated product/search handoff URLs.
- Local watchlist commands.
- Local schema/about metadata.

Forbidden unless there is explicit written authorization and a separate legal/safety review:

- Fetching or scraping blocked search, filter, sort, order, account, checkout, redirect, or tracking endpoints.
- Browser cookies, session extraction, HAR reverse engineering, auth replay, private APIs, or checkout automation.
- Treating generated URLs as fetched facts. `product url` and `search url` create links only.

## Workflow Recipes

Discover supported commands and schemas:

```bash
zap schema list --output json
zap schema get feed-search --output json
zap about --output json
```

Expected shapes:

```json
{ "commands": [{ "key": "feed-search", "name": "feed search", "description": "..." }] }
```

Discover RSS categories:

```bash
zap categories list --output json
```

Expected shape:

```json
{ "categories": [{ "id": "electric", "hebrewName": "...", "englishName": "...", "rssUrl": "..." }] }
```

Fetch or sync official RSS:

```bash
zap feed list --category electric --limit 20 --output json
zap feed sync --category electric --limit 20 --output json
```

Expected shapes:

```json
[
  {
    "id": "1253558",
    "title": "...",
    "descriptionText": "...",
    "category": "electric",
    "publishedAt": "2026-05-15T00:00:00.000Z",
    "modelId": "1253558",
    "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "imageUrl": "https://..."
  }
]
```

```json
{ "category": "electric", "synced": 20, "cachePath": "/.../zap.sqlite" }
```

Search local cache only:

```bash
zap feed search "Wiim" --limit 10 --output json
zap feed search "iphone" --select id,title,modelId,productUrl --output json
```

Expected shape: an array of cached RSS items. This command makes no network request; run `feed sync` first if results are empty.

Generate handoff URLs:

```bash
zap search url "iphone 17" --output json
zap product url --model-id 1253558 --output json
```

Expected shapes:

```json
{ "query": "iphone 17", "searchUrl": "https://www.zap.co.il/search.aspx?keyword=iphone+17", "fetched": false }
```

```json
{
  "modelId": "1253558",
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "reviewsUrl": "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
  "compareUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
}
```

Manage a local watchlist:

```bash
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17" --output json
zap watch list --output json
zap watch remove --id <watch-id> --output json
```

Expected shapes:

```json
{
  "id": "<uuid>",
  "modelId": "1253558",
  "title": "iPhone 17",
  "targetPriceIls": 2500,
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
  "notes": null,
  "createdAt": "2026-05-15T00:00:00.000Z"
}
```

```json
{ "id": "<watch-id>", "removed": true }
```

## Procurement Assistant Guidance

When making buying recommendations, separate evidence into:

- **Verified by CLI**: command output from `about`, `categories list`, `feed list`, `feed sync`, `feed search`, `product url`, `search url`, `watch *`, or `schema *`.
- **Browser/user observed**: model page details, vendor names, prices, shipping, warranty, stock, ratings, or screenshots supplied by the user or observed in an authorized browser session.
- **Inference**: your reasoning from the verified and observed data.

Ask for a model id or exact ZAP URL when offer/vendor scoring is required. If the user only gives a product name, generate a search handoff URL and/or search synced RSS cache, then ask the user to provide the chosen model URL or model id before scoring live offers.

Do not infer current prices, store trust, stock, shipping, or warranty from RSS titles or generated URLs alone. Cite the data source category in recommendations, for example: "CLI RSS cache", "generated handoff URL", or "user-supplied ZAP model page".

## Failure Handling

- Invalid arguments exit with code `2` and emit a JSON error envelope on stderr:

```json
{ "error": { "code": "INVALID_ARGUMENTS", "message": "...", "hint": "..." } }
```

- Other notable error codes: `NOT_FOUND` exits `5`, `NETWORK_ERROR` exits `7`, and `REMOTE_API_ERROR` exits `8`.
- Default cache path is `~/.cache/zap-cli/zap.sqlite`.
- Override cache location with `--cache-dir <path>` or `ZAP_CACHE_DIR`.
- `feed search` reads only the local cache. On a new or empty cache it returns `[]`; sync an official RSS category first.
- `feed list` and `feed sync` may return or sync zero items if the RSS feed is empty or items cannot be normalized to model ids. Fall back to handoff URLs and ask the user for exact model URLs when needed.

## Current Limitations

- There is no formal procurement-grade offer extraction command yet.
- There is no supported command for live vendor scoring, checkout, account-specific prices, stock, delivery estimates, or warranty extraction.
- `product url` and `search url` do not fetch ZAP pages.
- A future `product inspect --url` command may inspect one user-supplied model URL, but it is not currently available. Do not document or call it as an existing command.
