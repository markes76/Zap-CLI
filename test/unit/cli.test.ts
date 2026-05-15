import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/app.js";

describe("runCli", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
