# Agent Recon Notes

This note consolidates the first parallel agent pass for the ZAP CLI.

## Public Surface Classifications

Safe, bounded surfaces for CLI features:

- Official RSS: `/xmls/general/rss.aspx?cat=<category>`.
- OpenSearch descriptor: `/opensearch.xml`, with search URL generation only.
- Single product page by model id: `/model.aspx?modelid=<id>`.
- Specs page by model id: `/compmodels.aspx?modelid=<id>`.
- Public review page by model id with minimization: `/ratemodel.aspx?modelid=<id>`.
- Vendor profile summary by site id with minimization: `/clientcard.aspx?siteid=<id>`.

URL-handoff only:

- ZAP search URLs such as `/search.aspx?keyword=<terms>`.
- Vendor redirect links such as `/fs.aspx?...` and `/fsbid.aspx?...`.

Needs authorization or explicit legal review:

- Internal carousel/Ajax endpoints.
- Marketplace API base exposed to storefront JavaScript.
- Shop sitemap use beyond very bounded validation.

Off-limits:

- SSO, cart, checkout, account, payment, alert, push subscription, review submission, and automated redirect resolution.

## Search Roadmap

Next search-oriented commands:

- `zap search sync --category all --limit 50` for bounded official RSS batch sync.
- `zap search local "iphone 17 pro max" --brand Apple --storage 512 --category electric --limit 10`.
- `zap search suggest "iphone 17 pro max"` to combine local candidates, cache status, next commands, and official handoff URL.

Recommended local search fields:

- `brand`, `storageGb`, `normalizedTitle`, `attributesJson`, `syncedAt`, `reviewsUrl`, `specUrl`, `searchUrl`, `matchedFields`, `score`.

Ranking should stay deterministic and local: FTS score, exact phrase boost, all-term boost, brand/storage matches, title match, recency, and image presence. Do not rank by vendor price from RSS because RSS does not contain reliable offer data.

## Product Procurement Roadmap

Initial implemented command:

```bash
zap product inspect --model-id 1253618 --output json
```

Current output groups:

- Source URL, fetched timestamp, model id, title, safe links, warnings.
- JSON-LD Product fields when present.
- AggregateOffer fields and nested offers when present.
- Conservative static vendor-card attributes when reliable.

Future output groups:

- Product summary: title, brand, category, image, currency, min/max price, product rating, review count, source URL, fetched timestamp.
- Key specs: storage, screen size, announcement year, chipset, plus `specUrl`.
- Offers: seller name, site id, product id, rank, product price, shipping, total price, delivery days.
- Vendor quality: store rating, total reviews, last-year reviews, Zap Choice, Smart Buy, cheapest marker.
- Import/warranty: official/parallel/unspecified import, warranty duration, warranty provider.
- Links: product, specs, reviews, vendor profile; never follow `/fs*` redirects.

First-pass procurement ranking is now local over one explicit model page:

```bash
zap product offers --model-id 1253618 --limit 20 --output json
```

The current command ranks only observed static vendor cards and JSON-LD offers. It does not infer official import, warranty, final checkout totals, or redirect targets. A future `procure rank` command can add richer constraints after saved inspection and offer schemas stabilize.

## Skill Work

The new `skills/zap-cli/SKILL.md` documents:

- When to use the CLI.
- Consent-safe boundaries.
- Agent recipes for RSS, local search, URL handoff, and watchlists.
- Procurement guidance separating CLI-verified data from browser/user-observed data.
- Failure handling and current limitations.

## Immediate Implementation Sequence

1. Harden `product offers` across more observed product-page shapes.
2. Add saved inspection input support for `product offers --from-inspection`.
3. Add `procure rank` using only saved inspection/offer data.
4. Add `product specs`.
5. Add `vendor inspect --summary-only`.

Each phase should include schema updates, unit tests, CLI smoke checks, README examples, and scorecard updates.
