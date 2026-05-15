import type { ProductInspection, ProductOffer, ProductVendorCard } from "./types.js";

export const PROCUREMENT_SCHEMA_VERSION = "zap.product-offers.v1";

export interface RankProductOffersOptions {
  maxOffers?: number;
}

export interface ProcurementRankingPolicy {
  summary: string;
  primary: "lowest_price";
  secondary: "vendor_rating";
  tertiary: "review_count";
  officialImportInferred: false;
  orderedCriteria: string[];
  sourceScope: string[];
}

export interface RankedProcurementOffer {
  rank: number;
  source: "static_vendor_card" | "json_ld_offer";
  vendorName: string | null;
  priceIls: number | null;
  priceCurrency: string | null;
  importType: "unspecified";
  warranty: "unspecified";
  url: string | null;
  availabilityText: string | null;
  shippingText: string | null;
  rating: number | null;
  reviewCount: number | null;
  warnings: string[];
}

export interface ProcurementOfferRankingResult {
  schemaVersion: typeof PROCUREMENT_SCHEMA_VERSION;
  recordType: "product_offers";
  modelId: string;
  title: string | null;
  sourceUrl: string;
  fetchedAt: string;
  rankedOffers: RankedProcurementOffer[];
  warnings: string[];
  rankingPolicy: ProcurementRankingPolicy;
}

interface OfferCandidate {
  source: RankedProcurementOffer["source"];
  sourceIndex: number;
  vendorName: string | null;
  priceIls: number | null;
  priceCurrency: string | null;
  url: string | null;
  availabilityText: string | null;
  shippingText: string | null;
  rating: number | null;
  reviewCount: number | null;
  warnings: string[];
}

export function rankProductOffers(
  inspection: ProductInspection,
  options: RankProductOffersOptions = {}
): ProcurementOfferRankingResult {
  const candidates = [
    ...inspection.vendorCards.map((card, index) => vendorCardCandidate(card, index)),
    ...(inspection.aggregateOffer?.offers ?? []).map((offer, index) => jsonLdOfferCandidate(offer, index))
  ];
  const rankedOffers = candidates
    .toSorted(compareCandidates)
    .slice(0, normalizedMaxOffers(options.maxOffers))
    .map((candidate, index) => rankedOffer(candidate, index + 1));
  const warnings = uniqueWarnings([
    ...inspection.warnings,
    ...(candidates.length === 0 ? ["No procurement offers found in vendor cards or JSON-LD AggregateOffer offers."] : [])
  ]);

  return {
    schemaVersion: PROCUREMENT_SCHEMA_VERSION,
    recordType: "product_offers",
    modelId: inspection.modelId,
    title: inspection.title ?? null,
    sourceUrl: inspection.sourceUrl,
    fetchedAt: inspection.fetchedAt,
    rankedOffers,
    warnings,
    rankingPolicy: {
      summary:
        "Ranks only inspection.vendorCards and inspection.aggregateOffer.offers. Lower price wins, then higher rating, then higher review count; missing values are preserved as warnings. Official import and warranty are not inferred.",
      primary: "lowest_price",
      secondary: "vendor_rating",
      tertiary: "review_count",
      officialImportInferred: false,
      orderedCriteria: ["lower price", "higher rating", "higher review count", "source order"],
      sourceScope: ["inspection.vendorCards", "inspection.aggregateOffer.offers"]
    }
  };
}

function vendorCardCandidate(card: ProductVendorCard, sourceIndex: number): OfferCandidate {
  const warnings = missingDataWarnings(card.vendorName, [
    ["rating", card.rating],
    ["reviewCount", card.reviewCount]
  ]);

  return {
    source: "static_vendor_card",
    sourceIndex,
    vendorName: card.vendorName,
    priceIls: card.priceIls,
    priceCurrency: "ILS",
    url: null,
    availabilityText: card.availabilityText ?? null,
    shippingText: card.shippingText ?? null,
    rating: card.rating ?? null,
    reviewCount: card.reviewCount ?? null,
    warnings
  };
}

function jsonLdOfferCandidate(offer: ProductOffer, sourceIndex: number): OfferCandidate {
  const vendorName = offer.sellerName ?? null;
  const currency = offer.priceCurrency?.trim().toUpperCase();
  const priceIls = currency === "ILS" ? (offer.price ?? null) : null;
  const warnings = missingDataWarnings(vendorName, [
    ["vendorName", vendorName],
    ["price", offer.price],
    ["priceCurrency", currency],
    ["rating", undefined],
    ["reviewCount", undefined]
  ]).concat(offer.price !== undefined && currency && priceIls === null ? [`Offer from ${vendorName ?? "unknown seller"} has non-ILS currency and cannot provide priceIls.`] : []);

  return {
    source: "json_ld_offer",
    sourceIndex,
    vendorName,
    priceIls,
    priceCurrency: currency ?? null,
    url: offer.url ?? null,
    availabilityText: offer.availability ?? null,
    shippingText: null,
    rating: null,
    reviewCount: null,
    warnings
  };
}

function compareCandidates(left: OfferCandidate, right: OfferCandidate): number {
  return (
    compareNullableNumbers(left.priceIls, right.priceIls, "asc") ||
    compareNullableNumbers(left.rating, right.rating, "desc") ||
    compareNullableNumbers(left.reviewCount, right.reviewCount, "desc") ||
    sourcePriority(left.source) - sourcePriority(right.source) ||
    left.sourceIndex - right.sourceIndex
  );
}

function compareNullableNumbers(left: number | null, right: number | null, direction: "asc" | "desc"): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return direction === "asc" ? left - right : right - left;
}

function sourcePriority(source: RankedProcurementOffer["source"]): number {
  return source === "static_vendor_card" ? 0 : 1;
}

function rankedOffer(candidate: OfferCandidate, rank: number): RankedProcurementOffer {
  return {
    rank,
    source: candidate.source,
    vendorName: candidate.vendorName,
    priceIls: candidate.priceIls,
    priceCurrency: candidate.priceCurrency,
    importType: "unspecified",
    warranty: "unspecified",
    url: candidate.url,
    availabilityText: candidate.availabilityText,
    shippingText: candidate.shippingText,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    warnings: candidate.warnings
  };
}

function missingDataWarnings(sellerName: string | null, fields: Array<[string, unknown]>): string[] {
  const label = sellerName ?? "unknown seller";
  return fields.flatMap(([field, value]) => (value === undefined || value === null || value === "" ? [`Offer from ${label} is missing ${field}.`] : []));
}

function normalizedMaxOffers(maxOffers: number | undefined): number {
  if (maxOffers === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(maxOffers) || maxOffers < 0) {
    return 0;
  }
  return Math.floor(maxOffers);
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}
