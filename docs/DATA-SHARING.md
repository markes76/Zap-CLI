# Data Sharing and Export Design

Status: design proposal for the ZAP CLI export surface.

This document defines how `zap` should share data with humans, scripts, and agents while staying inside the project's consent-safe boundary. The current CLI already supports JSON, NDJSON, text output, official RSS fetch/sync/search, URL handoffs, watchlists, and schema introspection. The design below keeps those contracts compatible and adds practical export/report conventions for v1 and later releases.

## Goals

- Make every export deterministic, parseable, and explicit about source provenance.
- Keep machine formats stable enough for agents and shell pipelines.
- Provide human-readable Markdown and HTML reports without hiding machine-readable evidence.
- Support CSV for spreadsheets without flattening away important provenance.
- Keep local watchlist/cache data local unless the user explicitly writes an export file.
- Separate CLI-verified facts, browser/user-observed facts, and inference.

## Non-Goals

- No checkout, account, cart, payment, SSO, alert, review submission, or private API automation.
- No scraping blocked search/filter/sort/order/redirect/tracking endpoints.
- No automated resolution of `/fs*` vendor redirect URLs.
- No claim that RSS, generated URLs, or cached records prove current price, stock, warranty, shipping, or vendor trust.
- No automatic upload or cloud sharing from the CLI.

## Core Decisions

- Existing command output remains compatible: `--output json|text|ndjson`, default JSON when stdout is not a TTY, and JSON error envelopes on stderr.
- Current export commands write to stdout or to a local file with `--out <path>`.
- JSON is the canonical lossless format for all entities and reports.
- NDJSON is the canonical streaming format for homogeneous row collections such as RSS items, watch items, and vendor offers.
- Markdown is the default human report format for review in Git, issues, and agent transcripts.
- CSV is a flat table format. Nested entities are exported as separate files or selected field sets, not as lossy JSON strings unless the user explicitly selects a nested field.
- HTML reports are self-contained static files generated from the same report JSON. They must not include remote JavaScript or tracking.
- Exported records include provenance fields where they can be shared safely. Local cache paths, local file paths, and freeform watch notes are excluded unless explicitly requested.
- Adaptive-agent preferences and feedback are local user data. `agent suggest` and `agent skill draft` may summarize them, but the CLI must not upload them or apply skill/code changes automatically.

## Output Formats

### JSON

Use JSON for full-fidelity data exchange.

Rules:

- UTF-8, LF newlines, stable key ordering.
- ISO 8601 UTC timestamps, for example `2026-05-15T08:30:00.000Z`.
- Existing simple commands may keep returning arrays or command-shaped objects.
- New report/export commands should use a typed envelope:

```json
{
  "schemaVersion": "zap.procurement-report.v1",
  "createdAt": "2026-05-15T08:30:00.000Z",
  "source": {
    "tool": "zap",
    "command": "zap procure report --model-id 1253558 --output json"
  },
  "data": {}
}
```

Use JSON when a consumer needs nested structures, source commands, evidence labels, or report metadata.

### NDJSON

Use NDJSON for pipelines and bulk row export.

Rules:

- One JSON object per line.
- No blank lines.
- One homogeneous record type per file.
- The row shape is the entity shape, not a report envelope.
- Include `schemaVersion`, `recordType`, and safe provenance in each row for durable export files.
- Existing `--output ndjson` behavior can remain row-only for command stdout. Export commands should add the schema/provenance fields.

Example:

```json
{"schemaVersion":"zap.rss-item.v1","recordType":"rss_item","exportedAt":"2026-05-15T08:30:00.000Z","id":"1253558","title":"iPhone 17","category":"electric","publishedAt":"2026-05-15T00:00:00.000Z","modelId":"1253558","productUrl":"https://www.zap.co.il/model.aspx?modelid=1253558","imageUrl":"https://example.invalid/image.jpg","provenance":{"kind":"cli_verified","source":"official_rss","fetchedAt":"2026-05-15T08:29:55.000Z"}}
```

### Markdown

Use Markdown for human review and agent-readable summaries.

Rules:

- Include a short provenance section near the top.
- Keep recommendations separate from evidence.
- Link to ZAP handoff URLs, but do not embed cookies, session URLs, or redirect links.
- Images should be links or plain image URLs. Do not inline base64 images in Markdown exports.
- Use tables only where the row count is manageable. For large offer sets, link to JSON/CSV artifacts.

Recommended sections for procurement reports:

- Summary
- Recommendation
- Evidence Sources
- Candidate Products
- Ranked Offers
- Risks and Unknowns
- Next Actions
- Artifact Index

### CSV

Use CSV for spreadsheet workflows.

Rules:

- UTF-8 with a header row.
- RFC 4180 escaping.
- LF line endings.
- Flat scalar fields only.
- Column names use camelCase or dotted paths such as `vendor.rating`.
- Multi-table exports use a directory with one CSV per table and a JSON manifest.

Recommended table files:

- `rss-items.csv`
- `watch-items.csv`
- `product-inspections.csv`
- `vendor-offers.csv`
- `procurement-rankings.csv`

Example vendor offer columns:

```text
modelId,rank,vendorName,siteId,productPriceIls,shippingPriceIls,totalPriceIls,importType,warrantyMonths,vendor.rating,vendor.reviewCount,availabilityText,deliveryDaysMin,deliveryDaysMax,offerUrl,observedAt,sourceKind
```

### HTML

Use HTML for printable, shareable reports.

Rules:

- Static single file by default.
- Inline CSS is allowed.
- No remote JavaScript.
- No analytics, beacons, tracking pixels, or external fonts.
- Remote product images are linked, not embedded, unless the user explicitly chooses an offline bundle.
- All facts shown in HTML must come from the same report JSON that can be exported alongside it.
- Include a visible "Generated from" block with timestamp, CLI version, command, and safety notes.

## Command Proposals

These are proposals. Existing commands remain as documented in `zap schema list`.

### Global Flags

Keep:

```bash
--output json|text|ndjson
--quiet
--timeout <seconds>
--cache-dir <path>
--select id,title,productUrl
--no-color
```

Add for export/report commands:

```bash
--output json|ndjson|markdown|csv|html
--privacy public|private
--include-notes
--include-local-paths
--schema-version v1
```

Current export commands support only the formats listed in their schemas. `feed export` supports `json|ndjson|csv`; `watch export` supports `json|csv`. `--privacy`, Markdown, HTML, and report exports remain future work.
For JSON export envelopes, `--select` applies to `items` while preserving envelope metadata. For NDJSON and CSV exports, `--select` applies to row fields.

Defaults:

- `json` remains the preferred machine-readable default for export/report stdout.
- `markdown`, `csv`, and `html` are supported only on commands with explicit renderers.
- `--privacy public` excludes watch notes, local cache paths, local file paths, and raw browser observations that may contain personal data.
- `--privacy private` may include local-only context, but still excludes cookies, sessions, payment data, account identifiers, and checkout state.
- `--include-notes` is required to export freeform watch notes.
- `--include-local-paths` is required to export cache paths or local artifact paths.

### Feed Export

Export official RSS items from one live bounded official RSS category feed.

```bash
zap feed export --category electric --limit 50 --output json
zap feed export --category electric --limit 50 --output ndjson
zap feed export --category electric --limit 50 --output csv
zap feed export --category electric --limit 50 --output csv --out exports/rss/zap-rss-electric-20260515T083000Z.csv
```

Current behavior:

- `--category` fetches the official RSS feed, like `feed list`.
- JSON output uses an envelope with `items`.
- NDJSON/CSV output emits rows.
- `--out <path>` writes the rendered export artifact to that exact file path and returns a JSON status object. Existing files and the active cache database are not overwritten.
- `--from-cache` and `--query` are future features.

### Watch Export

Export local watchlist state.

```bash
zap watch export --output json
zap watch export --output csv
zap watch export --output csv --include-notes
zap watch export --output json --out exports/watch/zap-watchlist-20260515T083000Z.json
```

Design:

- Default export excludes `notes`.
- `--include-notes` includes freeform notes and sets `notesIncluded: true` in the manifest/envelope.
- CSV includes one row per watch item.
- `--out <path>` writes the rendered export artifact to that exact file path and returns a JSON status object. Existing files and the active cache database are not overwritten.
- Markdown is a future feature.

### Product Inspection

Current command:

```bash
zap product inspect --model-id 1253558 --output json
```

It writes JSON to stdout and fetches only the validated public `model.aspx?modelid=<id>` page. File export, Markdown rendering, URL input, `--include`, and `--out` are future export/report features, not current command behavior.

Future export/report examples:

```bash
zap product inspect --model-id 1253558 --include summary,specs,offers --limit 25 --output json --out exports/products/zap-product-1253558-inspection-20260515T083000Z.json
zap product inspect --url "https://www.zap.co.il/model.aspx?modelid=1253558" --include summary,offers --output markdown --out exports/products/zap-product-1253558-inspection-20260515T083000Z.md
```

Design:

- Accept only canonical product URLs or model ids.
- Fetch only the explicit public product/spec/review/vendor profile surfaces allowed by the safety model.
- Do not fetch search pages, filter pages, sort pages, checkout pages, account pages, or redirect URLs.
- Capture `observedAt` and source URL for every field that comes from a fetched product page.
- Unknown or unavailable fields are `null`, not inferred.

### Product Offers

Rank offer-like data observed during an explicit product-page inspection.

```bash
zap product offers --model-id 1253558 --limit 20 --output json
```

Current behavior:

- Fetches only the explicit `model.aspx?modelid=<id>` product page, with no credentials and redirects disabled.
- Ranks only observed JSON-LD offers and reliable static vendor-card metadata.
- Ranking prefers lower price, then vendor rating, then review count.
- `--limit` bounds the number of ranked rows returned.
- `importType` remains `unspecified`; official import, warranty, stock certainty, checkout totals, and vendor redirect targets are not inferred.

Future export examples:

```bash
zap product offers --model-id 1253558 --from-inspection exports/products/zap-product-1253558-inspection-20260515T083000Z.json --output ndjson --out exports/offers/zap-offers-1253558-20260515T083000Z.ndjson
zap product offers --model-id 1253558 --from-inspection exports/products/zap-product-1253558-inspection-20260515T083000Z.json --output csv --out exports/offers/zap-offers-1253558-20260515T083000Z.csv
```

### Procurement Reports

Create a recommendation report from explicit inputs.

```bash
zap procure report --model-id 1253558 --from-inspection exports/products/zap-product-1253558-inspection-20260515T083000Z.json --prefer official-import --min-store-rating 4.5 --output json --out exports/reports/zap-procurement-1253558-20260515T083000Z.json
zap procure report --model-id 1253558 --from-inspection exports/products/zap-product-1253558-inspection-20260515T083000Z.json --output markdown --out exports/reports/zap-procurement-1253558-20260515T083000Z.md
zap procure report --model-id 1253558 --from-inspection exports/products/zap-product-1253558-inspection-20260515T083000Z.json --output html --out exports/reports/zap-procurement-1253558-20260515T083000Z.html
```

Design:

- JSON is the source of truth.
- Markdown and HTML are renderings of the same report JSON.
- Reports may include recommendations, but each recommendation must cite evidence ids.
- Reports must preserve unresolved risks such as stock freshness, warranty ambiguity, or unknown delivery timing.

### Agent Handoff

Create a compact handoff for another agent or workflow.

```bash
zap handoff create --from-report exports/reports/zap-procurement-1253558-20260515T083000Z.json --output json --out exports/handoffs/zap-handoff-procurement-1253558-20260515T083000Z.json
zap handoff create --from-report exports/reports/zap-procurement-1253558-20260515T083000Z.json --output markdown --out exports/handoffs/zap-handoff-procurement-1253558-20260515T083000Z.md
```

Design:

- JSON handoff is canonical.
- Markdown handoff is a concise companion for chat, issues, or pull requests.
- Handoffs include current state, evidence pointers, remaining questions, and allowed next actions.
- Handoffs never include cookies, session data, payment data, account data, raw HTML, or screenshots unless a future explicit artifact policy allows them.

## Filenames and Artifact Layout

Current `--out <path>` behavior treats the value as an exact file path. Directory targets, default filename generation, and overwrite controls are future features.

Rules:

- Lowercase prefix: `zap`.
- Include entity type, stable identifier, and UTC timestamp.
- Use `YYYYMMDDTHHMMSSZ` timestamps to avoid characters that are awkward on some filesystems.
- Use lowercase slugs for queries or report names.
- Keep extensions honest: `.json`, `.ndjson`, `.md`, `.csv`, `.html`.
- Do not include user names, emails, account ids, or freeform note text in filenames.

Recommended layout:

```text
exports/
  rss/
    zap-rss-electric-20260515T083000Z.json
    zap-rss-electric-20260515T083000Z.ndjson
  watch/
    zap-watchlist-20260515T083000Z.csv
  products/
    zap-product-1253558-inspection-20260515T083000Z.json
  offers/
    zap-offers-1253558-20260515T083000Z.csv
  reports/
    zap-procurement-1253558-20260515T083000Z.json
    zap-procurement-1253558-20260515T083000Z.md
    zap-procurement-1253558-20260515T083000Z.html
  handoffs/
    zap-handoff-procurement-1253558-20260515T083000Z.json
```

Multi-table CSV exports should use a directory:

```text
exports/reports/zap-procurement-1253558-20260515T083000Z/
  manifest.json
  procurement-report.json
  product-inspections.csv
  vendor-offers.csv
  procurement-rankings.csv
```

## Schema Shapes

### Common Provenance

Use provenance wherever a fact may be interpreted as evidence.
Current v0.2 export commands emit `kind`, `source`, `sourceUrl` where applicable, and `fetchedAt`; future report formats may also include the exact command string.

```json
{
  "kind": "cli_verified",
  "source": "official_rss",
  "sourceUrl": "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
  "command": "zap feed export --category electric --limit 50 --output json",
  "fetchedAt": "2026-05-15T08:29:55.000Z"
}
```

Allowed `kind` values:

- `cli_verified`
- `browser_observed`
- `user_supplied`
- `inference`

Allowed `source` values should be specific, for example `official_rss`, `local_cache`, `generated_url`, `product_page`, `spec_page`, `vendor_profile`, `watchlist`, `report_rule`, or `agent_reasoning`.

### RSS Item

Current command shape:

```json
{
  "id": "1253558",
  "title": "iPhone 17",
  "descriptionText": "Product description from RSS",
  "category": "electric",
  "publishedAt": "2026-05-15T00:00:00.000Z",
  "modelId": "1253558",
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "imageUrl": "https://example.invalid/image.jpg"
}
```

Export row shape:

```json
{
  "schemaVersion": "zap.rss-item.v1",
  "recordType": "rss_item",
  "exportedAt": "2026-05-15T08:30:00.000Z",
  "id": "1253558",
  "title": "iPhone 17",
  "descriptionText": "Product description from RSS",
  "category": "electric",
  "publishedAt": "2026-05-15T00:00:00.000Z",
  "modelId": "1253558",
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "imageUrl": "https://example.invalid/image.jpg",
  "provenance": {
    "kind": "cli_verified",
    "source": "official_rss",
    "sourceUrl": "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
    "fetchedAt": "2026-05-15T08:29:55.000Z"
  }
}
```

### Watch Item

Current command shape:

```json
{
  "id": "3e93407d-49b0-4b12-a0e7-0c24d2f2b67f",
  "modelId": "1253558",
  "title": "iPhone 17",
  "targetPriceIls": 2500,
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
  "notes": null,
  "createdAt": "2026-05-15T08:30:00.000Z"
}
```

Public export row shape:

```json
{
  "schemaVersion": "zap.watch-item.v1",
  "recordType": "watch_item",
  "exportedAt": "2026-05-15T08:35:00.000Z",
  "id": "3e93407d-49b0-4b12-a0e7-0c24d2f2b67f",
  "modelId": "1253558",
  "title": "iPhone 17",
  "targetPriceIls": 2500,
  "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
  "notesIncluded": false,
  "createdAt": "2026-05-15T08:30:00.000Z",
  "provenance": {
    "kind": "cli_verified",
    "source": "watchlist"
  }
}
```

Current exports with `--include-notes` may include:

```json
{
  "notes": "User-entered local note",
  "notesIncluded": true
}
```

### Product Inspection

Current command shape:

```json
{
  "sourceUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "fetchedAt": "2026-05-15T08:40:00.000Z",
  "modelId": "1253558",
  "title": "iPhone 17",
  "jsonLdProduct": {
    "name": "iPhone 17",
    "description": "Product description when available",
    "brand": "Apple",
    "sku": "1253558",
    "image": ["https://example.invalid/image.jpg"]
  },
  "aggregateOffer": {
    "lowPrice": 2890,
    "highPrice": 3490,
    "offerCount": 12,
    "priceCurrency": "ILS",
    "offers": []
  },
  "links": {
    "canonicalUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "reviewsUrl": "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
    "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
  },
  "vendorCards": [],
  "warnings": []
}
```

Future export row shape:

```json
{
  "schemaVersion": "zap.product-inspection.v1",
  "recordType": "product_inspection",
  "modelId": "1253558",
  "title": "iPhone 17",
  "category": "electric",
  "brand": "Apple",
  "currency": "ILS",
  "inspectedAt": "2026-05-15T08:40:00.000Z",
  "sourceUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
  "summary": {
    "imageUrl": "https://example.invalid/image.jpg",
    "rating": 4.6,
    "reviewCount": 120,
    "minPriceIls": 2890,
    "maxPriceIls": 3490
  },
  "specs": {
    "storageGb": 256,
    "screenSizeInches": 6.1,
    "chipset": "A-series",
    "announcementYear": 2026
  },
  "links": {
    "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "specUrl": "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
    "reviewsUrl": "https://www.zap.co.il/ratemodel.aspx?modelid=1253558"
  },
  "offers": [],
  "provenance": {
    "kind": "cli_verified",
    "source": "product_page",
    "sourceUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "fetchedAt": "2026-05-15T08:40:00.000Z"
  }
}
```

Notes:

- `summary` and `specs` fields can be `null` when not observed.
- Numeric fields must be parsed only from the explicit product/spec source.
- `offers` uses the vendor offer shape below.
- RSS-derived data may be merged only with clear provenance per field or per section.

### Vendor Offer

Proposed shape:

```json
{
  "schemaVersion": "zap.vendor-offer.v1",
  "recordType": "vendor_offer",
  "offerId": "1253558:site-98765:rank-1",
  "modelId": "1253558",
  "rank": 1,
  "vendor": {
    "name": "Example Store",
    "siteId": "98765",
    "profileUrl": "https://www.zap.co.il/clientcard.aspx?siteid=98765",
    "rating": 4.8,
    "reviewCount": 340,
    "lastYearReviewCount": 80,
    "badges": ["zap_choice"]
  },
  "price": {
    "currency": "ILS",
    "productPriceIls": 2890,
    "shippingPriceIls": 0,
    "totalPriceIls": 2890
  },
  "availabilityText": "In stock",
  "deliveryDaysMin": 2,
  "deliveryDaysMax": 5,
  "importType": "official",
  "warranty": {
    "months": 12,
    "provider": "Example Importer",
    "text": "12 months official importer warranty"
  },
  "links": {
    "offerHandoffUrl": "https://www.zap.co.il/fs.aspx?pid=123456",
    "vendorProfileUrl": "https://www.zap.co.il/clientcard.aspx?siteid=98765"
  },
  "observedAt": "2026-05-15T08:40:00.000Z",
  "provenance": {
    "kind": "cli_verified",
    "source": "product_page",
    "sourceUrl": "https://www.zap.co.il/model.aspx?modelid=1253558",
    "fetchedAt": "2026-05-15T08:40:00.000Z"
  }
}
```

Notes:

- `offerHandoffUrl` may point to a ZAP redirect endpoint, but the CLI must not resolve it.
- Unknown `importType` should be `unspecified`, not guessed.
- `totalPriceIls` is present only when enough observed data exists to compute it. Otherwise it is `null`.

### Procurement Report

Proposed JSON source-of-truth shape:

```json
{
  "schemaVersion": "zap.procurement-report.v1",
  "recordType": "procurement_report",
  "reportId": "procure-1253558-20260515T083000Z",
  "createdAt": "2026-05-15T08:45:00.000Z",
  "subject": {
    "modelId": "1253558",
    "title": "iPhone 17",
    "category": "electric",
    "productUrl": "https://www.zap.co.il/model.aspx?modelid=1253558"
  },
  "constraints": {
    "budgetIls": 3000,
    "preferImportType": "official",
    "minStoreRating": 4.5,
    "minLastYearReviews": 25
  },
  "inputs": {
    "rssItemIds": ["1253558"],
    "inspectionIds": ["product-inspection:1253558:20260515T084000Z"],
    "watchItemIds": ["3e93407d-49b0-4b12-a0e7-0c24d2f2b67f"]
  },
  "rankedOffers": [
    {
      "rank": 1,
      "offerId": "1253558:site-98765:rank-1",
      "totalPriceIls": 2890,
      "score": 91,
      "decision": "recommended",
      "evidenceIds": ["offer:1253558:site-98765:rank-1", "vendor:98765"],
      "tradeoffs": ["Meets rating and import preferences", "Delivery window still needs browser confirmation before checkout"]
    }
  ],
  "recommendation": {
    "decision": "buy_candidate",
    "summary": "Best observed candidate under the provided constraints.",
    "evidenceIds": ["offer:1253558:site-98765:rank-1"],
    "requiresUserConfirmation": ["current stock", "final checkout total", "warranty terms"]
  },
  "risks": [
    {
      "severity": "medium",
      "text": "Observed stock and delivery data can change after inspection.",
      "evidenceKind": "inference"
    }
  ],
  "artifacts": [
    {
      "type": "json",
      "path": "zap-procurement-1253558-20260515T083000Z.json",
      "description": "Canonical procurement report"
    }
  ],
  "safety": {
    "noCheckoutAutomation": true,
    "noAccountData": true,
    "redirectsResolved": false
  }
}
```

### Agent Handoff

Canonical JSON handoff shape:

```json
{
  "schemaVersion": "zap.agent-handoff.v1",
  "recordType": "agent_handoff",
  "createdAt": "2026-05-15T08:50:00.000Z",
  "handoffId": "zap-handoff-procurement-1253558-20260515T085000Z",
  "intent": "Continue procurement review for model 1253558 without re-fetching unsafe surfaces.",
  "currentState": {
    "subject": "iPhone 17",
    "modelId": "1253558",
    "status": "offer_candidates_ranked"
  },
  "evidenceSummary": [
    {
      "evidenceId": "rss:1253558",
      "kind": "cli_verified",
      "source": "official_rss",
      "summary": "RSS item identified the model and product URL."
    },
    {
      "evidenceId": "offer:1253558:site-98765:rank-1",
      "kind": "cli_verified",
      "source": "product_page",
      "summary": "Offer observed during explicit product inspection."
    }
  ],
  "recommendedNextActions": [
    {
      "action": "ask_user_to_open_checkout",
      "reason": "Final stock, shipping, warranty, and checkout total require user confirmation."
    }
  ],
  "allowedActions": [
    "read_attached_report_json",
    "summarize_evidence",
    "ask_user_for_confirmation",
    "generate_safe_handoff_urls"
  ],
  "blockedActions": [
    "resolve_vendor_redirects",
    "use_browser_cookies",
    "automate_checkout",
    "fetch_blocked_search_pages"
  ],
  "artifacts": [
    {
      "type": "procurement_report",
      "path": "../reports/zap-procurement-1253558-20260515T083000Z.json"
    }
  ]
}
```

Markdown handoff should contain the same fields in a compact form:

```markdown
# ZAP Agent Handoff: 1253558

Intent: Continue procurement review without re-fetching unsafe surfaces.

## Current State

- Subject: iPhone 17
- Model ID: 1253558
- Status: offer_candidates_ranked

## Evidence Summary

| Evidence | Kind | Source | Summary |
| --- | --- | --- | --- |
| rss:1253558 | cli_verified | official_rss | RSS item identified the model and product URL. |

## Allowed Next Actions

- Read attached report JSON
- Summarize evidence
- Ask user for confirmation
- Generate safe handoff URLs

## Blocked Actions

- Resolve vendor redirects
- Use browser cookies
- Automate checkout
- Fetch blocked search pages
```

## Privacy and Safety Constraints

Exports must follow these constraints:

- No cookies, auth headers, browser storage, session ids, account ids, payment data, addresses, phone numbers, or checkout state.
- No raw HAR files.
- No raw HTML by default. Product inspection should emit normalized fields only.
- No local cache path or local artifact path unless `--include-local-paths` is supplied.
- No watch notes unless `--include-notes` is supplied.
- No generated filename may include freeform notes, user names, emails, or account identifiers.
- Public exports should mark omitted private fields with booleans such as `notesIncluded: false`, not with redacted strings that imply hidden content.
- Reports must label evidence as `cli_verified`, `browser_observed`, `user_supplied`, or `inference`.
- Recommendations must cite evidence ids and list unknowns that require user confirmation.
- HTML must not include remote JavaScript, analytics, external fonts, or tracking pixels.
- CSV exports must not silently serialize nested private data into a cell.
- CSV cells that begin with spreadsheet formula trigger characters are prefixed with an apostrophe.
- Redirect URLs may be emitted as handoff links but never resolved by the CLI.

## v1 Roadmap

The v1 export surface should be conservative and compatible with the current CLI.

Required for v1:

- Keep existing JSON and NDJSON command behavior stable.
- Harden current `feed export` JSON/NDJSON/CSV behavior from official RSS.
- Harden current `watch export` JSON/CSV behavior with notes excluded by default.
- Keep `--out <path>` available for export commands only.
- Document JSON schemas for RSS item and watch item exports.
- Add tests for stdout export, file export, privacy defaults, and CSV escaping.
- Keep Markdown/HTML procurement report rendering out of v1 until product inspection and procurement report JSON schemas are stable.

Acceptable v1 stretch:

- Markdown watchlist export.
- Agent handoff JSON for RSS/watchlist/search URL workflows that do not require product inspection.
- Manifest files for multi-file CSV exports.

## Later Roadmap

After v1, add procurement-grade formats in phases:

1. Harden `product inspect` coverage across product categories while keeping JSON output first.
2. `product offers` export from saved inspection JSON, with NDJSON and CSV output.
3. `procure report` JSON, using explicit inspection inputs and local ranking rules.
4. Markdown procurement report rendering from report JSON.
5. Self-contained HTML procurement report rendering from report JSON.
6. Agent handoff JSON/Markdown for procurement reports.
7. Multi-table CSV report bundles with manifest files.
8. Optional offline HTML bundles with downloaded images only after a separate artifact policy review.
9. Compatibility policy for schema evolution, including deprecation windows and versioned schemas.

## Compatibility Policy

- Additive fields are allowed in `*.v1` schemas.
- Removing fields, changing field meaning, or changing scalar types requires a new schema version.
- Unknown fields should be ignored by consumers.
- Required fields must be documented in `zap schema get <command>`.
- Deprecated fields should remain for one minor release with a warning in schema metadata.
- `--select` applies after command execution and before formatting. Consumers should not depend on omitted fields when `--select` is used.
