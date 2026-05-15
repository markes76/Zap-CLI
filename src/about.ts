export function aboutZapCli(): Record<string, unknown> {
  return {
    name: "zap-cli",
    purpose: "Consent-safe consumer shopping research CLI for zap.co.il.",
    target: "ZAP is an Israeli price comparison and shopping marketplace with product comparison, store ratings, reviews, price alerts, and Zap Store handoff.",
    methodology: "Manual TypeScript implementation of cli-printing-press patterns: JSON-first output, schema introspection, local SQLite/FTS cache, and agent-safe non-interactive commands.",
    safetyPolicy: [
      "Use official RSS feeds and explicit single-model product pages for fetched data.",
      "Generate search/product URLs without fetching blocked search, filter, sort, account, checkout, redirect, or tracking endpoints.",
      "Fetch product pages only from validated numeric model ids with no cookies, auth, redirects, or hidden API calls.",
      "Keep watchlists and cached search local to the user."
    ],
    sources: [
      "https://www.zap.co.il/about.aspx",
      "https://www.zap.co.il/takanon.aspx",
      "https://www.zap.co.il/robots.txt",
      "https://www.zap.co.il/opensearch.xml",
      "https://www.zap.co.il/rss.aspx",
      "https://github.com/mvanhorn/cli-printing-press"
    ]
  };
}
