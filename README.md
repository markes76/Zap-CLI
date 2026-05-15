# ZAP CLI

<p align="center">
  <img src="assets/brand/zap-logo-readme.png" alt="ZAP logo" width="450">
</p>

Consent-safe consumer CLI for [zap.co.il](https://www.zap.co.il/), built for shoppers, researchers, and AI agents that need deterministic shopping research commands.

`zap` follows the spirit of [mvanhorn/cli-printing-press](https://github.com/mvanhorn/cli-printing-press): JSON-first output, schema introspection, local SQLite/FTS cache, clear exit codes, and documentation that stays current with the CLI.

The adaptive-agent direction is local and reviewable: preferences, feedback, diagnostics, and skill drafts are stored locally and surfaced as suggestions. The CLI does not silently rewrite itself, shared skills, or user data.

This is an unofficial project. The ZAP logo is included only to identify the website this CLI targets; see [NOTICE.md](NOTICE.md).

עברית: [תקציר בעברית](#עברית) נמצא בהמשך הקובץ.

## What It Does

- Fetches official ZAP RSS feeds with conservative limits.
- Generates ZAP product/search handoff URLs without fetching blocked search pages.
- Fetches one explicit public product page only when `product inspect --model-id` or `product offers --model-id` is used.
- Searches cached RSS results locally with SQLite/FTS.
- Keeps watchlists, preferences, and feedback on your machine.
- Exports RSS and watchlist data as JSON, NDJSON, or CSV.
- Gives AI agents stable schemas through `zap schema`.

## Safety Model

`zap` is intentionally conservative:

- It uses official RSS feeds and one explicit `model.aspx?modelid=<id>` product page.
- It does not fetch blocked search, filter, sort, account, checkout, redirect, tracking, private API, cookie/session, or HAR-derived flows.
- Product-page fetches use validated numeric model ids, omit credentials, and reject redirects.
- Offer ranking does not infer official import, warranty, stock certainty, checkout totals, or vendor redirect targets.
- Adaptive-agent commands are local-only and produce reviewable suggestions instead of automatic code or skill changes.

Primary references:

- [ZAP About](https://www.zap.co.il/about.aspx)
- [ZAP Terms](https://www.zap.co.il/takanon.aspx)
- [robots.txt](https://www.zap.co.il/robots.txt)
- [OpenSearch](https://www.zap.co.il/opensearch.xml)
- [RSS page](https://www.zap.co.il/rss.aspx)

## Requirements

- Node.js 24 or newer
- pnpm 10 or newer
- Git

The project uses Node's built-in SQLite support, so Node 24+ is required.

## Install

The package is not published to npm yet. Install from GitHub/source:

```bash
git clone https://github.com/markes76/Zap-CLI.git
cd Zap-CLI
pnpm install
pnpm build
```

Run directly from the built file:

```bash
node dist/cli.js about --output json
```

For local development:

```bash
pnpm dev -- schema list --output json
```

Optional local global command:

```bash
pnpm link --global
zap about --output json
```

If global linking is not configured on your machine, use `node dist/cli.js ...`.

## Using With an Agent

You do not need to memorize every `zap` command. If you are working with an AI coding agent or terminal agent that can read this repository, you can write a plain-language request and let the agent choose the right install, search, sync, inspect, watchlist, or export commands.

Examples:

```text
Download and install the ZAP CLI, then search ZAP for iPhone 17 options and export the useful results as CSV.
```

```text
Use this package to inspect model 1253558, rank the observed offers, and give me JSON plus a short human summary.
```

The CLI is designed for that workflow: command schemas are available through `zap schema`, output is JSON-first, errors have a stable JSON envelope, and every command is non-interactive.

## Quick Start

```bash
node dist/cli.js about --output json
node dist/cli.js categories list --output json
node dist/cli.js feed list --category electric --limit 5 --output json
node dist/cli.js search url "iphone 17" --output json
node dist/cli.js product url --model-id 1253558 --output json
node dist/cli.js product inspect --model-id 1253558 --timeout 10 --output json
node dist/cli.js product offers --model-id 1253558 --limit 5 --timeout 10 --output json
```

Use `zap` instead of `node dist/cli.js` if you linked the package globally.

## Common Commands

```bash
zap about
zap categories list
zap cache info
zap agent profile get
zap agent profile set --key preferred.output --value json
zap agent feedback add --command "product offers" --rating 5 --output-format json
zap agent suggest
zap agent skill draft
zap feed list --category electric --limit 20
zap feed sync --category electric --limit 20
zap feed search Wiim --limit 10
zap feed export --category electric --limit 20 --output csv
zap feed export --category electric --limit 20 --output csv --out exports/feed.csv
zap search sync --category electric,comp --limit 20
zap search local "iphone 17" --category electric --sort relevance --limit 10
zap search suggest "iphone 17" --limit 5
zap product url --model-id 1253558
zap product inspect --model-id 1253558
zap product offers --model-id 1253558 --limit 20 --output json
zap search url "iphone 17"
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17"
zap watch list
zap watch export --output json
zap watch export --output csv --include-notes
zap watch export --output json --out exports/watch.json
zap watch remove --id <watch-id>
zap schema list
zap schema get product-inspect
```

Every command is explained in [docs/COMMANDS.md](docs/COMMANDS.md), including when to use it, examples, output shape, and safety notes.

## Global Flags

```bash
--output json|text|ndjson
-o json|text|ndjson
--quiet
-q
--timeout <seconds>
--cache-dir <path>
--select id,title,productUrl
--no-color
```

Export commands support their own format sets:

- `feed export --output json|ndjson|csv`
- `watch export --output json|csv`

`--out <path>` writes exact file paths for export commands and returns a JSON status object unless `--quiet` is used. Existing files and the active cache database are not overwritten.

## Output Contract

When stdout is piped, output defaults to JSON. Errors always use JSON on stderr:

```json
{
  "error": {
    "code": "INVALID_ARGUMENTS",
    "message": "Missing required flag --model-id.",
    "hint": "Run zap schema get product-url for command details."
  }
}
```

Stable exit codes are documented through command behavior and tests. Agent workflows should prefer `--output json`.

## Local Data

Default local cache:

```text
~/.cache/zap-cli/zap.sqlite
```

Override it with:

```bash
zap cache info --cache-dir ./tmp-cache --output json
ZAP_CACHE_DIR=./tmp-cache zap cache info --output json
```

The cache may contain RSS items, watchlist entries, adaptive-agent preferences, and explicit feedback. Do not commit cache files.

## Development

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm check
pnpm build
```

The integration test calls one official RSS feed with a small limit and timeout.

## Project Docs

- [Command reference](docs/COMMANDS.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Data sharing and export design](docs/DATA-SHARING.md)
- [Scorecard](docs/SCORECARD.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT License for project code. See [LICENSE](LICENSE). The ZAP logo is not covered by the MIT license; see [NOTICE.md](NOTICE.md).

---

# עברית

`ZAP CLI` הוא כלי שורת פקודה בטוח וזהיר למחקר קניות באתר [zap.co.il](https://www.zap.co.il/). הכלי מיועד למשתמשים, חוקרים וסוכני AI שצריכים פלט יציב, קריא למכונה, ולא אינטראקטיבי.

הכלי לא מנסה לעקוף את ZAP. הוא משתמש במקורות ציבוריים ומוגבלים: RSS רשמי, יצירת קישורי מעבר, ועמוד מוצר ציבורי אחד רק כאשר המשתמש מבקש זאת במפורש עם `--model-id`.

זהו פרויקט לא רשמי. הלוגו של ZAP מופיע לצורך זיהוי האתר בלבד; ראו [NOTICE.md](NOTICE.md).

## מה הכלי עושה

- מושך RSS רשמי של ZAP עם מגבלות שמרניות.
- יוצר קישורי חיפוש ומוצר בלי למשוך דפי חיפוש חסומים.
- מושך עמוד מוצר ציבורי אחד בלבד עבור `product inspect` או `product offers`.
- שומר חיפוש מקומי ב-SQLite/FTS.
- מנהל רשימת מעקב מקומית.
- מייצא נתונים ל-JSON, NDJSON או CSV.
- שומר העדפות ומשוב של המשתמש באופן מקומי בלבד.

## מודל בטיחות

- אין שימוש בעוגיות, סשנים, HAR, התחברות לחשבון, עגלת קניות או checkout.
- אין משיכה של דפי חיפוש, פילטרים, מיון, חשבון, redirect או API פרטי.
- דירוג הצעות לא מנחש יבואן רשמי, אחריות, מלאי, מחיר סופי בקופה או יעד redirect של חנות.
- פקודות ה-agent הן מקומיות בלבד ומציעות שינויים לבדיקה; הן לא משנות קוד או קבצי skill באופן אוטומטי.

## דרישות התקנה

- Node.js 24 ומעלה
- pnpm 10 ומעלה
- Git

## התקנה

החבילה עדיין לא מפורסמת ב-npm. מתקינים מהמקור:

```bash
git clone https://github.com/markes76/Zap-CLI.git
cd Zap-CLI
pnpm install
pnpm build
```

הרצה ישירה:

```bash
node dist/cli.js about --output json
```

הרצה בפיתוח:

```bash
pnpm dev -- schema list --output json
```

קישור מקומי אופציונלי לפקודת `zap`:

```bash
pnpm link --global
zap about --output json
```

אם הקישור הגלובלי לא מוגדר במחשב, השתמשו ב-`node dist/cli.js ...`.

## שימוש עם סוכן AI

אין צורך לזכור את כל פקודות `zap`. אם אתם עובדים עם סוכן AI או סוכן טרמינל שיכול לקרוא את המאגר הזה, אפשר לכתוב בקשה בשפה רגילה והסוכן יבחר את פקודות ההתקנה, החיפוש, הסנכרון, בדיקת המוצר, רשימת המעקב או הייצוא המתאימות.

דוגמאות:

```text
תוריד ותתקין את ZAP CLI, חפש ב-ZAP אפשרויות ל-iPhone 17, וייצא את התוצאות השימושיות ל-CSV.
```

```text
השתמש בחבילה הזאת כדי לבדוק את model 1253558, לדרג את ההצעות שנמצאו, ולהחזיר JSON יחד עם סיכום קצר.
```

ה-CLI בנוי בדיוק לשימוש כזה: סכמות פקודה זמינות דרך `zap schema`, הפלט מכוון ל-JSON, שגיאות חוזרות במבנה JSON יציב, וכל הפקודות לא אינטראקטיביות.

## התחלה מהירה

```bash
node dist/cli.js about --output json
node dist/cli.js categories list --output json
node dist/cli.js feed list --category electric --limit 5 --output json
node dist/cli.js search url "iphone 17" --output json
node dist/cli.js product url --model-id 1253558 --output json
node dist/cli.js product inspect --model-id 1253558 --timeout 10 --output json
node dist/cli.js product offers --model-id 1253558 --limit 5 --timeout 10 --output json
```

## פקודות נפוצות

```bash
zap about
zap categories list
zap cache info
zap feed list --category electric --limit 20
zap search local "iphone 17" --category electric --sort relevance --limit 10
zap product url --model-id 1253558
zap product inspect --model-id 1253558
zap product offers --model-id 1253558 --limit 20 --output json
zap watch add --model-id 1253558 --target-price 2500 --title "iPhone 17"
zap watch list
zap schema list
zap schema get product-offers
```

כל הפקודות מוסברות בפירוט בקובץ [docs/COMMANDS.md](docs/COMMANDS.md): מתי להשתמש, דוגמאות, מבנה פלט והערות בטיחות.

## דגלים גלובליים

```bash
--output json|text|ndjson
--quiet
--timeout <seconds>
--cache-dir <path>
--select id,title,productUrl
--no-color
```

עבור סוכני AI וסקריפטים מומלץ להשתמש ב-`--output json`.

## נתונים מקומיים

ברירת המחדל לקובץ cache:

```text
~/.cache/zap-cli/zap.sqlite
```

אפשר לשנות מיקום:

```bash
zap cache info --cache-dir ./tmp-cache --output json
ZAP_CACHE_DIR=./tmp-cache zap cache info --output json
```

ה-cache יכול לכלול פריטי RSS, רשימת מעקב, העדפות ומשוב. אין להעלות קבצי cache ל-Git.

## פיתוח ובדיקות

```bash
pnpm test
pnpm check
pnpm build
```

## רישיון

MIT License עבור קוד הפרויקט. ראו [LICENSE](LICENSE). הלוגו של ZAP אינו כלול ברישיון MIT; ראו [NOTICE.md](NOTICE.md).
