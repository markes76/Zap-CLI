import { closeSync, existsSync, mkdtempSync, openSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/app.js";
import { categories } from "../../src/categories.js";
import { ZapStore } from "../../src/store.js";
import type { RssItem } from "../../src/types.js";

describe("runCli", () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns schema list as JSON data", async () => {
    const result = await runCli(["schema", "list", "--output", "json"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        commands: expect.arrayContaining([expect.objectContaining({ name: "feed list" })])
      })
    );
  });

  it("keeps --help as a boolean command alias", async () => {
    const result = await runCli(["--help", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({ commands: expect.any(Array) }));
  });

  it("returns exit code 2 and JSON error for invalid args", async () => {
    const result = await runCli(["product", "url"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Missing required flag --model-id.",
        hint: "Run zap schema get product-url for command details."
      }
    });
  });

  it("prints search urls without fetching blocked search pages", async () => {
    const result = await runCli(["search", "url", "iphone 17", "--output", "json"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      query: "iphone 17",
      searchUrl: "https://www.zap.co.il/search.aspx?keyword=iphone+17",
      fetched: false
    });
  });

  it("lists the local search command schemas", async () => {
    const result = await runCli(["schema", "list", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        commands: expect.arrayContaining([
          expect.objectContaining({ key: "search-sync", name: "search sync" }),
          expect.objectContaining({ key: "search-local", name: "search local" }),
          expect.objectContaining({ key: "search-suggest", name: "search suggest" })
        ])
      })
    );
  });

  it("syncs comma-separated official RSS categories into the local cache", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const category = url.searchParams.get("cat") ?? "unknown";
      return new Response(rssXmlForCategory(category), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(
      ["search", "sync", "--category", "electric,comp", "--limit", "2", "--output", "json"],
      cliContext(dir)
    );

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toEqual({
      categories: ["electric", "comp"],
      synced: 2,
      perCategory: [
        { category: "electric", synced: 1 },
        { category: "comp", synced: 1 }
      ],
      cachePath: join(dir, "zap.sqlite")
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("error");
    }
  });

  it("syncs all supported official RSS categories", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const category = url.searchParams.get("cat") ?? "unknown";
      return new Response(rssXmlForCategory(category), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "sync", "--category", "all", "--limit", "1", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.categories).toEqual(categories.map((category) => category.id));
    expect(output.synced).toBe(categories.length);
    expect(output.perCategory).toEqual(categories.map((category) => ({ category: category.id, synced: 1 })));
    expect(output.cachePath).toBe(join(dir, "zap.sqlite"));
    expect(fetchMock).toHaveBeenCalledTimes(categories.length);
  });

  it("rejects invalid search sync categories before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "sync", "--category", "electric,unknown", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported RSS category "unknown".',
        hint: expect.stringContaining("Supported categories:")
      }
    });
  });

  it("searches locally cached RSS items without fetching", async () => {
    const dir = tempCacheDir(dirs);
    seedStore(dir, [
      rssItem({ id: "1264897", title: "Wiim Mini streamer", category: "electric", publishedAt: "2026-05-14T12:02:00.000Z" }),
      rssItem({ id: "2264897", title: "Wiim software license", category: "comp", publishedAt: "2026-05-15T12:02:00.000Z" })
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(
      ["search", "local", "Wiim", "--category", "electric", "--limit", "5", "--sort", "newest", "--output", "json"],
      cliContext(dir)
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({
        id: "1264897",
        title: "Wiim Mini streamer",
        category: "electric"
      })
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid local search sort values", async () => {
    const result = await runCli(["search", "local", "Wiim", "--sort", "price", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported search sort "price".',
        hint: "Use relevance or newest."
      }
    });
  });

  it("rejects missing flag values instead of silently defaulting", async () => {
    const result = await runCli(["search", "local", "Wiim", "--sort", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Missing value for --sort.",
        hint: "Pass a value after --sort or use --sort=<value>."
      }
    });
  });

  it("rejects invalid local search categories without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "local", "Wiim", "--category", "unknown", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported RSS category "unknown".',
        hint: expect.stringContaining("Supported categories:")
      }
    });
  });

  it("returns an empty local search result for an empty cache", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "local", "missing", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suggests local matches and an official search handoff without fetching", async () => {
    const dir = tempCacheDir(dirs);
    seedStore(dir, [rssItem({ id: "1264897", title: "Wiim Mini streamer", category: "electric" })]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "suggest", "Wiim Mini", "--limit", "3", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      query: "Wiim Mini",
      searchUrl: "https://www.zap.co.il/search.aspx?keyword=Wiim+Mini",
      fetched: false,
      cacheStatus: "searched",
      cacheResults: [expect.objectContaining({ id: "1264897", title: "Wiim Mini streamer" })],
      nextCommands: [
        {
          command: "search local",
          argv: ["zap", "search", "local", "Wiim Mini", "--limit", "3"]
        },
        {
          command: "search url",
          argv: ["zap", "search", "url", "Wiim Mini"]
        }
      ]
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses structured next command argv for hostile search queries", async () => {
    const dir = tempCacheDir(dirs);
    seedStore(dir, [rssItem({ id: "1264897", title: "$(curl example.invalid) streamer", category: "electric" })]);
    const result = await runCli(["search", "suggest", "$(curl example.invalid)", "--limit", "1", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.nextCommands).toEqual([
      {
        command: "search local",
        argv: ["zap", "search", "local", "$(curl example.invalid)", "--limit", "1"]
      },
      {
        command: "search url",
        argv: ["zap", "search", "url", "$(curl example.invalid)"]
      }
    ]);
  });

  it("suggests a handoff without creating a cache when cache is missing", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["search", "suggest", "iphone 17", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        query: "iphone 17",
        fetched: false,
        cacheStatus: "empty",
        cacheResults: []
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "zap.sqlite"))).toBe(false);
  });

  it("suggests a handoff without mutating an unreadable cache file", async () => {
    const dir = tempCacheDir(dirs);
    closeSync(openSync(join(dir, "zap.sqlite"), "w"));

    const result = await runCli(["search", "suggest", "iphone 17", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        query: "iphone 17",
        fetched: false,
        cacheStatus: "unavailable",
        cacheResults: [],
        cacheWarnings: ["Local cache could not be read; returned handoff URL only."]
      })
    );
    expect(statSync(join(dir, "zap.sqlite")).size).toBe(0);
  });

  it("inspects one validated product page with structured product data", async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://www.zap.co.il/model.aspx?modelid=1253558">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Wiim Mini",
              "description": "Compact streamer",
              "brand": { "@type": "Brand", "name": "Wiim" },
              "sku": "1264897",
              "image": ["https://img.zap.co.il/pic.jpg"],
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "349",
                "highPrice": "489",
                "offerCount": "12",
                "priceCurrency": "ILS",
                "offers": [
                  {
                    "@type": "Offer",
                    "price": "349",
                    "priceCurrency": "ILS",
                    "availability": "https://schema.org/InStock",
                    "seller": { "@type": "Organization", "name": "Shop A" }
                  }
                ]
              }
            }
          </script>
        </head>
        <body>
          <article
            data-shop-name="Shop Static"
            data-price="359"
            data-shipping="Free delivery"
            data-availability="In stock"
            data-rating="4.7"
            data-review-count="128"
          >
            <h2>Shop Static</h2>
          </article>
        </body>
      </html>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "inspect", "--model-id", "1253558", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.zap.co.il/model.aspx?modelid=1253558");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
    expect(JSON.stringify(init.headers).toLowerCase()).not.toContain("cookie");
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        sourceUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
        modelId: "1253558",
        title: "Wiim Mini",
        jsonLdProduct: {
          name: "Wiim Mini",
          description: "Compact streamer",
          brand: "Wiim",
          sku: "1264897",
          image: ["https://img.zap.co.il/pic.jpg"]
        },
        aggregateOffer: {
          lowPrice: 349,
          highPrice: 489,
          offerCount: 12,
          priceCurrency: "ILS",
          offers: [
            {
              sellerName: "Shop A",
              price: 349,
              priceCurrency: "ILS",
              availability: "https://schema.org/InStock"
            }
          ]
        },
        links: {
          canonicalUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
          reviewsUrl: "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
          specUrl: "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
        },
        vendorCards: [
          {
            vendorName: "Shop Static",
            priceIls: 359,
            shippingText: "Free delivery",
            availabilityText: "In stock",
            rating: 4.7,
            reviewCount: 128
          }
        ],
        warnings: []
      })
    );
  });

  it("ranks product offers from one validated product page only", async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://www.zap.co.il/model.aspx?modelid=1253558">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "iPhone 17 Pro Max",
              "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "ILS",
                "offers": [
                  {
                    "@type": "Offer",
                    "price": "4790",
                    "seller": { "@type": "Organization", "name": "JSON Store" }
                  }
                ]
              }
            }
          </script>
        </head>
        <body>
          <article data-shop-name="Lowest Price" data-price="4590" data-rating="4.1" data-review-count="12"></article>
          <article data-shop-name="Better Rated" data-price="4690" data-rating="4.9" data-review-count="220"></article>
        </body>
      </html>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "--model-id", "1253558", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.zap.co.il/model.aspx?modelid=1253558");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
    expect(JSON.stringify(init.headers).toLowerCase()).not.toContain("cookie");
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        schemaVersion: "zap.product-offers.v1",
        recordType: "product_offers",
        modelId: "1253558",
        title: "iPhone 17 Pro Max",
        sourceUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
        rankingPolicy: expect.objectContaining({
          primary: "lowest_price",
          secondary: "vendor_rating",
          officialImportInferred: false
        }),
        rankedOffers: [
          expect.objectContaining({
            rank: 1,
            vendorName: "Lowest Price",
            priceIls: 4590,
            source: "static_vendor_card",
            importType: "unspecified"
          }),
          expect.objectContaining({
            rank: 2,
            vendorName: "Better Rated",
            priceIls: 4690,
            source: "static_vendor_card",
            importType: "unspecified"
          }),
          expect.objectContaining({
            rank: 3,
            vendorName: "JSON Store",
            priceIls: 4790,
            source: "json_ld_offer",
            importType: "unspecified"
          })
        ],
        warnings: []
      })
    );
  });

  it("limits product offer rankings before emitting output", async () => {
    const html = `<!doctype html>
      <html>
        <head><title>Limited Product</title></head>
        <body>
          <article data-shop-name="First" data-price="100"></article>
          <article data-shop-name="Second" data-price="110"></article>
        </body>
      </html>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "--model-id", "1253558", "--limit", "1", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        rankedOffers: [expect.objectContaining({ rank: 1, vendorName: "First" })]
      })
    );
  });

  it("ranks a single JSON-LD Offer product shape", async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Single Offer Product",
              "offers": {
                "@type": "Offer",
                "price": "4790",
                "priceCurrency": "ILS",
                "seller": { "@type": "Organization", "name": "Single JSON Store" }
              }
            }
          </script>
        </head>
      </html>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "--model-id", "1253558", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        rankedOffers: [
          expect.objectContaining({
            rank: 1,
            source: "json_ld_offer",
            vendorName: "Single JSON Store",
            priceIls: 4790,
            priceCurrency: "ILS",
            importType: "unspecified",
            warranty: "unspecified"
          })
        ]
      })
    );
  });

  it("does not turn AggregateOffer summaries into vendor offers", async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Summary Only Product",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "4590",
                "highPrice": "4990",
                "offerCount": "4",
                "priceCurrency": "ILS"
              }
            }
          </script>
        </head>
      </html>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "--model-id", "1253558", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        rankedOffers: [],
        warnings: [
          "No reliable static vendor card metadata found.",
          "No procurement offers found in vendor cards or JSON-LD AggregateOffer offers."
        ]
      })
    );
  });

  it("rejects invalid product inspect model ids without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "inspect", "--model-id", "../checkout", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Invalid model id \"../checkout\".",
        hint: "Use a numeric ZAP model id such as 1253558."
      }
    });
  });

  it("rejects invalid product offers model ids without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "--model-id", "../checkout", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Invalid model id \"../checkout\".",
        hint: "Use a numeric ZAP model id such as 1253558."
      }
    });
  });

  it("rejects extra product offers arguments before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["product", "offers", "stale", "--model-id", "1253558", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unexpected argument "stale" for product offers.'
      }
    });
  });
});

function tempCacheDir(dirs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zap-cli-"));
  dirs.push(dir);
  return dir;
}

function cliContext(cacheDir: string) {
  return {
    stdoutIsTTY: false,
    env: {
      ...process.env,
      ZAP_CACHE_DIR: cacheDir
    }
  };
}

function seedStore(cacheDir: string, items: RssItem[]): void {
  const store = new ZapStore(join(cacheDir, "zap.sqlite"));
  try {
    store.upsertRssItems(items);
  } finally {
    store.close();
  }
}

function rssItem(overrides: Partial<RssItem>): RssItem {
  const id = overrides.id ?? "1264897";
  return {
    id,
    title: "Wiim Mini streamer",
    descriptionText: "Compact streamer by Wiim",
    category: "electric",
    publishedAt: "2026-05-14T12:02:00.000Z",
    modelId: id,
    productUrl: `https://www.zap.co.il/model.aspx?modelid=${id}`,
    imageUrl: null,
    ...overrides
  };
}

function rssXmlForCategory(category: string): string {
  const modelId = modelIdForCategory(category);
  return `<?xml version="1.0" encoding="windows-1255"?>
    <rss version="2.0"><channel>
      <item>
        <title><![CDATA[${category} cache item]]></title>
        <description><![CDATA[official ${category} feed item]]></description>
        <pubDate>Thu, 14 May 2026 12:02:00 GMT</pubDate>
        <link>https://www.zap.co.il/model.aspx?modelid=${modelId}</link>
      </item>
    </channel></rss>`;
}

function modelIdForCategory(category: string): string {
  const index = categories.findIndex((item) => item.id === category);
  return String(1_000_001 + (index >= 0 ? index : 99));
}
