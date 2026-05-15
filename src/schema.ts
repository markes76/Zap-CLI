export interface CommandSchema {
  key: string;
  name: string;
  description: string;
  usage: string;
  output: string;
  safety: string;
}

export const commandSchemas: CommandSchema[] = [
  {
    key: "about",
    name: "about",
    description: "Show project purpose, data sources, and consent-safe constraints.",
    usage: "zap about",
    output: "Project metadata and source links.",
    safety: "Does not fetch ZAP pages."
  },
  {
    key: "categories-list",
    name: "categories list",
    description: "List official RSS top-level categories supported by the CLI.",
    usage: "zap categories list",
    output: "Category ids, Hebrew names, English names, and RSS URLs.",
    safety: "Uses static category metadata from the public RSS page."
  },
  {
    key: "cache-info",
    name: "cache info",
    description: "Inspect local SQLite cache status and counts.",
    usage: "zap cache info",
    output: "Cache path, existence/readability flags, RSS/watch counts, and per-category RSS counts.",
    safety: "Offline local read only; does not create a missing cache."
  },
  {
    key: "agent-profile-get",
    name: "agent profile get",
    description: "Show local adaptive-agent preferences.",
    usage: "zap agent profile get",
    output: "Cache path and local preference records.",
    safety: "Offline local read only; does not create a missing cache."
  },
  {
    key: "agent-profile-set",
    name: "agent profile set",
    description: "Store one explicit local adaptive-agent preference.",
    usage: "zap agent profile set --key preferred.output --value json",
    output: "Saved preference key, value, and update timestamp.",
    safety: "Local SQLite write only; does not fetch ZAP and does not update code or skill files."
  },
  {
    key: "agent-profile-unset",
    name: "agent profile unset",
    description: "Remove one explicit local adaptive-agent preference.",
    usage: "zap agent profile unset --key preferred.output",
    output: "Preference key and removal status.",
    safety: "Local SQLite write only; does not fetch ZAP and does not update code or skill files."
  },
  {
    key: "agent-feedback-add",
    name: "agent feedback add",
    description: "Record explicit local feedback about a command result.",
    usage: "zap agent feedback add --command \"search local iphone\" --rating 5 --output-format json",
    output: "Saved feedback id, command, rating, output format, optional notes, and timestamp.",
    safety: "Local SQLite write only; feedback is user-provided and never sent to ZAP."
  },
  {
    key: "agent-feedback-list",
    name: "agent feedback list",
    description: "List explicit local adaptive-agent feedback records.",
    usage: "zap agent feedback list --limit 20",
    output: "Cache path and recent feedback records.",
    safety: "Offline local read only; does not create a missing cache."
  },
  {
    key: "agent-suggest",
    name: "agent suggest",
    description: "Suggest adaptive behavior from local preferences and feedback.",
    usage: "zap agent suggest",
    output: "Cache path, preferences, feedback summary, recommendations, and a reviewable skill draft.",
    safety: "Offline local read only; suggestions are not applied automatically."
  },
  {
    key: "agent-skill-draft",
    name: "agent skill draft",
    description: "Draft reviewable skill notes from local adaptive-agent state.",
    usage: "zap agent skill draft",
    output: "Cache path, format=markdown, and draft lines. The CLI does not write skill files.",
    safety: "Offline local read only; produces a reviewable draft instead of modifying shared skills."
  },
  {
    key: "feed-list",
    name: "feed list",
    description: "Fetch a bounded official ZAP RSS feed.",
    usage: "zap feed list --category electric --limit 20",
    output: "Normalized RSS items.",
    safety: "Fetches only official /xmls/general/rss.aspx category feeds."
  },
  {
    key: "feed-export",
    name: "feed export",
    description: "Export a bounded official ZAP RSS category feed.",
    usage: "zap feed export --category electric --limit 20 --output json|ndjson|csv [--out <path>]",
    output: "Without --out: JSON envelope with schemaVersion, recordType=rss_item, category, exportedAt, sourceUrl, provenance, and items; NDJSON rows include nested provenance; CSV rows include flattened provenance fields plus scalar RSS item fields. With --out: writes the exact file path and returns a JSON status object with outputPath, format, recordType, itemCount, and bytes.",
    safety: "Fetches only official /xmls/general/rss.aspx category feeds."
  },
  {
    key: "feed-sync",
    name: "feed sync",
    description: "Fetch a bounded official RSS feed and cache it in local SQLite.",
    usage: "zap feed sync --category electric --limit 20",
    output: "Sync count and category metadata.",
    safety: "Writes only local cache data."
  },
  {
    key: "feed-search",
    name: "feed search",
    description: "Search locally cached RSS items using SQLite FTS.",
    usage: "zap feed search Wiim --limit 10",
    output: "Cached RSS items matching the query.",
    safety: "Offline local search; no ZAP network request."
  },
  {
    key: "product-url",
    name: "product url",
    description: "Generate canonical ZAP product handoff URLs.",
    usage: "zap product url --model-id 1253558",
    output: "Product, review, and comparison URLs.",
    safety: "Generates URLs only; does not fetch them."
  },
  {
    key: "product-inspect",
    name: "product inspect",
    description: "Fetch one public ZAP product page and extract static product metadata.",
    usage: "zap product inspect --model-id 1253558",
    output: "Source URL, fetch timestamp, JSON-LD Product fields, AggregateOffer fields, safe inferred links, vendor card metadata when reliable, and warnings.",
    safety: "Fetches only https://www.zap.co.il/model.aspx?modelid=<id> after numeric model-id validation; no cookies, auth, redirects, search, filters, ordering, or hidden API crawling."
  },
  {
    key: "product-offers",
    name: "product offers",
    description: "Fetch one public ZAP product page and rank offer-like static metadata.",
    usage: "zap product offers --model-id 1253558 --limit 20 --output json",
    output: "Product offer ranking envelope with schemaVersion, recordType=product_offers, source product metadata, rankingPolicy, rankedOffers, and warnings. Import type and warranty stay unspecified unless explicitly observed.",
    safety: "Fetches only https://www.zap.co.il/model.aspx?modelid=<id> after numeric model-id validation; ranks only JSON-LD offers and reliable static vendor-card metadata; no redirects, hidden API calls, cookies, checkout, or offer-link resolution."
  },
  {
    key: "search-url",
    name: "search url",
    description: "Generate the official ZAP search URL without fetching it.",
    usage: "zap search url \"iphone 17\"",
    output: "Search URL with fetched=false.",
    safety: "Does not fetch search pages, which are blocked by robots."
  },
  {
    key: "search-sync",
    name: "search sync",
    description: "Fetch bounded official RSS feeds and cache them locally for offline search.",
    usage: "zap search sync --category electric,comp --limit 20",
    output: "Synced categories, per-category counts, total synced count, and SQLite cache path.",
    safety: "Fetches only official /xmls/general/rss.aspx category feeds and writes local cache data."
  },
  {
    key: "search-local",
    name: "search local",
    description: "Search locally cached RSS items using SQLite FTS.",
    usage: "zap search local Wiim --category electric --limit 10 --sort relevance",
    output: "Cached RSS items matching the query.",
    safety: "Offline local search; no ZAP network request."
  },
  {
    key: "search-suggest",
    name: "search suggest",
    description: "Return offline cached candidates plus an official ZAP search handoff URL.",
    usage: "zap search suggest \"iphone 17\" --category electric --limit 5",
    output: "Query, searchUrl, fetched=false, cache status, optional cache warnings, cacheResults, and structured suggested next command argv arrays.",
    safety: "Offline local cache access only; never fetches ZAP search pages."
  },
  {
    key: "watch-add",
    name: "watch add",
    description: "Add a local watchlist item.",
    usage: "zap watch add --model-id 1253558 --target-price 2500 --title \"iPhone 17\"",
    output: "Created watch item.",
    safety: "Local SQLite write only."
  },
  {
    key: "watch-list",
    name: "watch list",
    description: "List local watchlist items.",
    usage: "zap watch list",
    output: "Local watch items.",
    safety: "Offline local read."
  },
  {
    key: "watch-export",
    name: "watch export",
    description: "Export local watchlist items.",
    usage: "zap watch export --output json|csv [--include-notes] [--out <path>]",
    output: "Without --out: JSON envelope with schemaVersion, recordType=watch_item, exportedAt, provenance, notesIncluded, and items; notes are null unless --include-notes is used. CSV rows include flattened provenance fields plus scalar watch item fields. With --out: writes the exact file path and returns a JSON status object with outputPath, format, recordType, itemCount, and bytes.",
    safety: "Offline local read; no ZAP network request."
  },
  {
    key: "watch-remove",
    name: "watch remove",
    description: "Remove a local watchlist item.",
    usage: "zap watch remove --id <watch-id>",
    output: "Removal status.",
    safety: "Local SQLite delete only."
  },
  {
    key: "schema-list",
    name: "schema list",
    description: "List machine-readable command schemas.",
    usage: "zap schema list",
    output: "Command schema index.",
    safety: "Offline metadata."
  },
  {
    key: "schema-get",
    name: "schema get",
    description: "Show one machine-readable command schema.",
    usage: "zap schema get product-url",
    output: "One command schema.",
    safety: "Offline metadata."
  }
];

export function listSchemas(): { commands: Array<Pick<CommandSchema, "key" | "name" | "description">> } {
  return {
    commands: commandSchemas.map(({ key, name, description }) => ({ key, name, description }))
  };
}

export function getSchema(keyOrName: string): CommandSchema | undefined {
  const normalized = keyOrName.trim().toLowerCase().replace(/\s+/g, "-");
  return commandSchemas.find((schema) => schema.key === normalized || schema.name.replace(/\s+/g, "-") === normalized);
}
