# CLI Printing Press Scorecard

## Agent Safety

- JSON output defaults when stdout is not a TTY.
- Errors use structured JSON envelopes on stderr.
- Commands do not prompt.
- No ANSI formatting in JSON/NDJSON output.
- Command contracts are available through `zap schema`.

## ZAP Consent Boundary

- RSS fetches use official category feeds only.
- `product inspect --model-id` fetches one validated public product page with no credentials or redirects.
- Search URL commands and product URL commands generate handoff URLs.
- Blocked search/filter/order/account/checkout/redirect endpoints are not fetched.
- Local watchlist and cache data stay on the user's machine.

## Current Checks

```bash
pnpm test:unit
pnpm test:integration
pnpm check
pnpm build
```

## v1 Gate

- CI green.
- Command schemas frozen for v1.
- Security policy added.
- Public README reviewed for accurate compliance language.
- Release notes prepared.
