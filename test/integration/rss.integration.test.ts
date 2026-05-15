import { describe, expect, it } from "vitest";
import { fetchRssFeed } from "../../src/rss.js";

describe("official ZAP RSS feed", () => {
  it("fetches a small official RSS category feed", async () => {
    const items = await fetchRssFeed("electric", { limit: 3, timeoutMs: 10_000 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items[0]).toEqual(
      expect.objectContaining({
        category: "electric",
        productUrl: expect.stringMatching(/^https:\/\/www\.zap\.co\.il\/model\.aspx\?modelid=\d+/)
      })
    );
  });
});
