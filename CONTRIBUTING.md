# Contributing

This repository is public for community testing. The CLI is still pre-v1, so command schemas may change before the first stable release.

## Development Rules

- Keep `main` clean.
- Use focused feature branches named by purpose.
- Update README, ROADMAP, ARCHITECTURE, or CHANGELOG when behavior changes.
- Do not add code that fetches blocked ZAP search/filter/order/account/checkout/redirect endpoints.
- Do not commit cookies, session files, `.env`, local SQLite databases, or browser auth state.

## Checks

Run these before opening or updating a PR:

```bash
pnpm test
pnpm check
pnpm build
```

## Commit Style

Use terse, descriptive commits:

```text
bootstrap zap cli
add rss cache search
document v1 release path
```
