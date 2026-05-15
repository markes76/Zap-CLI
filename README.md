# ZAP CLI

Consent-safe consumer CLI for [zap.co.il](https://www.zap.co.il/), built for humans and AI agents that need deterministic shopping research commands.

This project follows the spirit of [mvanhorn/cli-printing-press](https://github.com/mvanhorn/cli-printing-press): JSON-first command output, local SQLite/FTS sync, schema introspection, clear exit codes, and docs that stay current with the CLI.

## Safety Model

`zap` is intentionally conservative:

- Fetches official ZAP RSS feeds and one explicit public product page when `product inspect --model-id` is used.
- Generates product and search handoff URLs without fetching blocked search, filter, sort, account, checkout, redirect, or tracking endpoints.
- Stores watchlists and synced search data locally.
- Does not use browser cookies, session extraction, HAR reverse engineering, checkout automation, or private APIs.

Primary source references:

- [ZAP About](https://www.zap.co.il/about.aspx)
- [ZAP Terms](https://www.zap.co.il/takanon.aspx)
- [robots.txt](https://www.zap.co.il/robots.txt)
- [OpenSearch](https://www.zap.co.il/opensearch.xml)
- [RSS page](https://www.zap.co.il/rss.aspx)

## Install

```bash
pnpm install
pnpm build
```

Run locally without installing:

```bash
pnpm dev -- schema list --output json
```

After building:

```bash
node dist/cli.js about --output json
```

## Commands

```bash
zap about
zap categories list
zap feed list --category electric --limit 20
zap feed sync --category electric --limit 20
zap feed search Wiim --limit 10
zap feed export --category electric --limit 20 --output csv
zap search sync --category electric,comp --limit 20
zap search local "iphone 17" --category electric --sort relevance --limit 10
zap search suggest "iphone 17" --limit 5
zap product url --model-id 1253558
zap product inspect --model-id 1253558
zap search url "iphone 17"
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17"
zap watch list
zap watch export --output json
zap watch export --output csv --include-notes
zap watch remove --id <watch-id>
zap schema list
zap schema get product-inspect
```

Global flags:

```bash
--output json|text|ndjson
--quiet
--timeout <seconds>
--cache-dir <path>
--select id,title,productUrl
--no-color
```

Export commands support their own format sets, including CSV: `feed export --output json|ndjson|csv` and `watch export --output json|csv`.
On export commands, `--select` filters item or row fields while preserving the JSON envelope metadata.

When stdout is piped, output defaults to JSON. Errors are always emitted as JSON on stderr:

```json
{
  "error": {
    "code": "INVALID_ARGUMENTS",
    "message": "Missing required flag --model-id.",
    "hint": "Run zap schema get product-url for command details."
  }
}
```

## Development

```bash
pnpm test:unit
pnpm test:integration
pnpm check
pnpm build
```

The integration test calls one official RSS feed with a small limit and timeout.

Additional project notes live in `docs/`, including the current scorecard, agent reconnaissance, next steps, PR status, and data-sharing/export design.

## Release Status

This repo is private during early development. v1 will be prepared for the community after the CLI has stable command schemas, CI, release notes, security guidance, and package metadata.
