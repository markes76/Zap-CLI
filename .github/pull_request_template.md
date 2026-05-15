## Summary

- 

## Safety Boundary

- [ ] This change avoids blocked ZAP search/filter/sort/account/checkout/cart/redirect/tracking/private API/cookie/session/HAR flows.
- [ ] This change does not commit local cache files, secrets, cookies, browser auth state, or personal data.
- [ ] User-visible behavior is documented in README, docs, schemas, roadmap, architecture, or changelog as appropriate.

## Verification

```bash
pnpm test
pnpm check
pnpm build
```

## Notes

Add known limitations, follow-up work, or screenshots only when relevant.
