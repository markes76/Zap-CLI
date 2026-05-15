import { describe, expect, it } from "vitest";
import { rankProductOffers } from "../../src/procurement.js";
import type { ProductInspection } from "../../src/types.js";

describe("procurement offer ranking", () => {
  it("sorts vendor cards by price, rating, then review count", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [
          { vendorName: "Higher Price", priceIls: 120, rating: 5, reviewCount: 900 },
          { vendorName: "Best Tie Break", priceIls: 100, rating: 4.8, reviewCount: 12 },
          { vendorName: "Lower Reviews", priceIls: 100, rating: 4.8, reviewCount: 3 },
          { vendorName: "Lower Rating", priceIls: 100, rating: 4.2, reviewCount: 500 }
        ]
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: "zap.product-offers.v1",
        recordType: "product_offers",
        modelId: "12345",
        title: "Reference Product",
        sourceUrl: "https://www.zap.co.il/model.aspx?modelid=12345",
        fetchedAt: "2026-05-15T08:00:00.000Z",
        rankingPolicy: expect.objectContaining({
          orderedCriteria: ["lower price", "higher rating", "higher review count", "source order"]
        })
      })
    );
    expect(result.rankedOffers.map((offer) => offer.vendorName)).toEqual(["Best Tie Break", "Lower Reviews", "Lower Rating", "Higher Price"]);
    expect(result.rankedOffers.map((offer) => offer.rank)).toEqual([1, 2, 3, 4]);
    expect(result.rankedOffers.every((offer) => offer.source === "static_vendor_card")).toBe(true);
  });

  it("falls back to JSON-LD aggregate offers when vendor cards are absent", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [],
        aggregateOffer: {
          offers: [
            { sellerName: "JSON Seller B", price: 80, priceCurrency: "ILS", availability: "InStock", url: "https://example.test/b" },
            { sellerName: "JSON Seller A", price: 70, priceCurrency: "ILS", availability: "InStock", url: "https://example.test/a" }
          ]
        }
      })
    );

    expect(result.rankedOffers).toEqual([
      expect.objectContaining({
        rank: 1,
        source: "json_ld_offer",
        vendorName: "JSON Seller A",
        priceIls: 70,
        priceCurrency: "ILS",
        url: "https://example.test/a"
      }),
      expect.objectContaining({
        rank: 2,
        source: "json_ld_offer",
        vendorName: "JSON Seller B",
        priceIls: 80,
        priceCurrency: "ILS",
        url: "https://example.test/b"
      })
    ]);
    expect(result.rankedOffers[0]?.warnings).toContain("Offer from JSON Seller A is missing rating.");
    expect(result.rankedOffers[0]?.warnings).toContain("Offer from JSON Seller A is missing reviewCount.");
    expect(result.warnings).toEqual([]);
  });

  it("normalizes lowercase JSON-LD offer currency", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [],
        aggregateOffer: {
          priceCurrency: "ils",
          offers: [{ sellerName: "JSON Seller", price: 70, priceCurrency: "ils" }]
        }
      })
    );

    expect(result.rankedOffers[0]).toEqual(
      expect.objectContaining({
        vendorName: "JSON Seller",
        priceIls: 70,
        priceCurrency: "ILS"
      })
    );
  });

  it("limits ranked offers when maxOffers is provided", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [
          { vendorName: "A", priceIls: 100 },
          { vendorName: "B", priceIls: 110 }
        ]
      }),
      { maxOffers: 1 }
    );

    expect(result.rankedOffers).toEqual([expect.objectContaining({ rank: 1, vendorName: "A" })]);
  });

  it("returns a no-offers warning when neither bounded source has offers", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [],
        aggregateOffer: { offers: [] },
        warnings: ["No reliable static vendor card metadata found."]
      })
    );

    expect(result.rankedOffers).toEqual([]);
    expect(result.warnings).toEqual([
      "No reliable static vendor card metadata found.",
      "No procurement offers found in vendor cards or JSON-LD AggregateOffer offers."
    ]);
  });

  it("does not guess official import or warranty fields from seller names", () => {
    const result = rankProductOffers(
      inspection({
        vendorCards: [{ vendorName: "Official Import Warranty Store", priceIls: 100, rating: 4.9, reviewCount: 10 }]
      })
    );

    expect(result.rankingPolicy.officialImportInferred).toBe(false);
    expect(result.rankedOffers[0]).toEqual(
      expect.objectContaining({
        vendorName: "Official Import Warranty Store",
        priceIls: 100,
        priceCurrency: "ILS",
        importType: "unspecified",
        warranty: "unspecified"
      })
    );
  });
});

function inspection(overrides: Partial<ProductInspection> = {}): ProductInspection {
  return {
    sourceUrl: "https://www.zap.co.il/model.aspx?modelid=12345",
    fetchedAt: "2026-05-15T08:00:00.000Z",
    modelId: "12345",
    title: "Reference Product",
    links: {
      canonicalUrl: "https://www.zap.co.il/model.aspx?modelid=12345",
      reviewsUrl: "https://www.zap.co.il/ratemodel.aspx?modelid=12345",
      specUrl: "https://www.zap.co.il/compmodels.aspx?modelid=12345"
    },
    vendorCards: [],
    warnings: [],
    ...overrides
  };
}
