# Security Policy

## Supported Versions

`zap-cli` is pre-v1. Security fixes are handled on `main` until stable releases are tagged.

## Reporting a Vulnerability

Please report security issues privately by opening a GitHub security advisory if available, or by contacting the repository owner through GitHub.

Do not open a public issue for vulnerabilities involving:

- credential leakage
- unsafe fetching of blocked ZAP surfaces
- command injection
- path traversal
- local cache exposure
- accidental collection of cookies, sessions, account data, checkout state, or payment data

## Project Safety Boundary

This project must not:

- fetch ZAP account, checkout, cart, private API, redirect, tracking, blocked search/filter/sort, cookie/session, or HAR-derived flows
- commit local SQLite databases, `.env` files, cookies, browser auth state, or screenshots containing personal/account data
- silently rewrite code, shared skills, or user files through adaptive-agent behavior

Adaptive-agent commands must keep preference and feedback data local unless the user explicitly exports or shares it.

## עברית

## מדיניות אבטחה

הפרויקט עדיין לפני גרסה יציבה v1. תיקוני אבטחה מטופלים בענף `main` עד שיהיו גרסאות מסומנות.

דווחו על בעיות אבטחה באופן פרטי דרך GitHub Security Advisory אם האפשרות זמינה, או דרך בעל המאגר ב-GitHub.

אין לפתוח issue ציבורי עבור בעיות שכוללות:

- דליפת credentials
- משיכה לא בטוחה של אזורים חסומים ב-ZAP
- command injection
- path traversal
- חשיפת cache מקומי
- איסוף לא מכוון של עוגיות, סשנים, נתוני חשבון, checkout או פרטי תשלום

הפרויקט לא אמור למשוך דפי חשבון, checkout, עגלה, API פרטי, redirect, tracking, דפי חיפוש/פילטר/מיון חסומים, או תהליכים שמבוססים על cookies, sessions או HAR.
