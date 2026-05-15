import { CliError } from "./errors.js";
import type {
  JsonLdProductFields,
  ProductAggregateOffer,
  ProductInspection,
  ProductOffer,
  ProductUrls,
  ProductVendorCard
} from "./types.js";
import { getProductUrls } from "./urls.js";

interface InspectProductOptions {
  timeoutMs?: number;
  fetcher?: typeof fetch;
  now?: () => Date;
}

interface ParseProductInspectionOptions {
  urls: ProductUrls;
  fetchedAt: string;
}

type JsonRecord = Record<string, unknown>;

export async function inspectProduct(modelIdInput: string, options: InspectProductOptions = {}): Promise<ProductInspection> {
  const urls = getProductUrls(modelIdInput);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher(urls.productUrl, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "zap-cli/0.1 consent-safe product inspector"
      }
    });

    if (!response.ok) {
      throw new CliError("REMOTE_API_ERROR", `ZAP product page returned HTTP ${response.status}.`, urls.productUrl);
    }

    const html = await response.text();
    return parseProductInspection(html, {
      urls,
      fetchedAt: (options.now ?? (() => new Date()))().toISOString()
    });
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    const message =
      error instanceof Error && error.name === "AbortError" ? "Timed out fetching ZAP product page." : "Failed to fetch ZAP product page.";
    throw new CliError("NETWORK_ERROR", message, urls.productUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseProductInspection(html: string, options: ParseProductInspectionOptions): ProductInspection {
  const warnings: string[] = [];
  const jsonLdNodes = parseJsonLdNodes(html, warnings);
  const productNode = findProductNode(jsonLdNodes);
  const jsonLdProduct = productNode ? normalizeJsonLdProduct(productNode) : undefined;
  const aggregateOffer = productNode ? normalizeAggregateOffer(findAggregateOffer(productNode)) : undefined;
  const canonicalCandidate = extractLinkHref(html, "canonical");
  const canonicalUrl = canonicalCandidate ? normalizeZapProductUrl(canonicalCandidate, options.urls.modelId) : null;
  const vendorCards = extractVendorCards(html);
  const title = firstText(
    jsonLdProduct?.name,
    extractMetaContent(html, "og:title"),
    extractHeadingText(html, "h1"),
    extractTitleText(html)
  );

  if (canonicalCandidate && !canonicalUrl) {
    warnings.push("Ignored canonical link that did not match the requested product model id.");
  }
  if (!title) {
    warnings.push("No product title found in static HTML or JSON-LD.");
  }
  if (!productNode) {
    warnings.push("No JSON-LD Product data found.");
  } else if (!jsonLdProduct || Object.keys(jsonLdProduct).length === 0) {
    warnings.push("JSON-LD Product data had no supported fields.");
  }
  if (!aggregateOffer || Object.keys(aggregateOffer).length === 0) {
    warnings.push("No AggregateOffer data found.");
  }
  if (vendorCards.length === 0) {
    warnings.push("No reliable static vendor card metadata found.");
  }

  return {
    sourceUrl: options.urls.productUrl,
    fetchedAt: options.fetchedAt,
    modelId: options.urls.modelId,
    ...(title ? { title } : {}),
    ...(jsonLdProduct && Object.keys(jsonLdProduct).length > 0 ? { jsonLdProduct } : {}),
    ...(aggregateOffer && Object.keys(aggregateOffer).length > 0 ? { aggregateOffer } : {}),
    links: {
      canonicalUrl: canonicalUrl ?? options.urls.productUrl,
      reviewsUrl: options.urls.reviewsUrl,
      specUrl: options.urls.compareUrl
    },
    vendorCards,
    warnings
  };
}

function parseJsonLdNodes(html: string, warnings: string[]): JsonRecord[] {
  const nodes: JsonRecord[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] ?? "");
    if ((attrs.type ?? "").trim().toLowerCase() !== "application/ld+json") {
      continue;
    }

    const text = (match[2] ?? "").trim();
    if (!text) {
      continue;
    }

    try {
      collectJsonRecords(JSON.parse(text), nodes);
    } catch {
      warnings.push("Skipped malformed JSON-LD block.");
    }
  }

  return nodes;
}

function collectJsonRecords(value: unknown, target: JsonRecord[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonRecords(item, target);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  target.push(value);
  collectJsonRecords(value["@graph"], target);
}

function findProductNode(nodes: JsonRecord[]): JsonRecord | undefined {
  return nodes.find((node) => hasSchemaType(node, "Product"));
}

function normalizeJsonLdProduct(product: JsonRecord): JsonLdProductFields {
  const normalized: JsonLdProductFields = {};
  assignText(normalized, "name", asText(product.name));
  assignText(normalized, "description", asText(product.description));
  assignText(normalized, "brand", namedValue(product.brand));
  assignText(normalized, "sku", asText(product.sku));
  assignText(normalized, "mpn", asText(product.mpn));
  assignText(normalized, "gtin", firstText(asText(product.gtin), asText(product.gtin13), asText(product.gtin12), asText(product.gtin8)));
  assignText(normalized, "url", safeHttpUrl(asText(product.url)));

  const images = imageValues(product.image);
  if (images.length > 0) {
    normalized.image = images;
  }

  return normalized;
}

function findAggregateOffer(product: JsonRecord): JsonRecord | undefined {
  for (const candidate of toArray(product.offers)) {
    if (!isRecord(candidate)) {
      continue;
    }
    if (hasSchemaType(candidate, "AggregateOffer") || hasAny(candidate, ["lowPrice", "highPrice", "offerCount", "offers"])) {
      return candidate;
    }
  }
  return undefined;
}

function normalizeAggregateOffer(aggregate: JsonRecord | undefined): ProductAggregateOffer | undefined {
  if (!aggregate) {
    return undefined;
  }

  const normalized: ProductAggregateOffer = {};
  assignNumber(normalized, "lowPrice", numericValue(aggregate.lowPrice));
  assignNumber(normalized, "highPrice", numericValue(aggregate.highPrice));
  assignNumber(normalized, "offerCount", numericValue(aggregate.offerCount));
  assignText(normalized, "priceCurrency", asText(aggregate.priceCurrency));

  const offers = toArray(aggregate.offers)
    .flatMap((offer) => normalizeOffer(offer))
    .filter((offer) => Object.keys(offer).length > 0);
  if (offers.length > 0) {
    normalized.offers = offers;
  }

  return normalized;
}

function normalizeOffer(value: unknown): ProductOffer[] {
  if (!isRecord(value)) {
    return [];
  }

  const offer: ProductOffer = {};
  assignText(offer, "sellerName", namedValue(value.seller));
  assignNumber(offer, "price", numericValue(value.price));
  assignText(offer, "priceCurrency", asText(value.priceCurrency));
  assignText(offer, "availability", asText(value.availability));
  assignText(offer, "url", safeHttpUrl(asText(value.url)));
  return [offer];
}

function extractVendorCards(html: string): ProductVendorCard[] {
  const cards: ProductVendorCard[] = [];
  const tagPattern = /<[a-z][\w:-]*\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] ?? "");
    const vendorName = firstText(
      attrs["data-vendor-name"],
      attrs["data-shop-name"],
      attrs["data-merchant-name"],
      attrs["data-seller-name"]
    );
    const priceIls = numericValue(firstText(attrs["data-price-ils"], attrs["data-price"], attrs["data-final-price"]));

    if (!vendorName || priceIls === undefined) {
      continue;
    }

    const card: ProductVendorCard = { vendorName, priceIls };
    assignText(card, "shippingText", firstText(attrs["data-shipping"], attrs["data-shipping-text"]));
    assignText(card, "availabilityText", firstText(attrs["data-availability"], attrs["data-availability-text"]));
    assignNumber(card, "rating", numericValue(attrs["data-rating"]));
    assignNumber(card, "reviewCount", numericValue(attrs["data-review-count"]));
    cards.push(card);
  }

  return cards;
}

function extractMetaContent(html: string, name: string): string {
  const tagPattern = /<meta\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] ?? "");
    const key = firstText(attrs.property, attrs.name).toLowerCase();
    if (key === name.toLowerCase()) {
      return asText(attrs.content);
    }
  }

  return "";
}

function extractLinkHref(html: string, rel: string): string {
  const tagPattern = /<link\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] ?? "");
    const rels = (attrs.rel ?? "").toLowerCase().split(/\s+/);
    if (rels.includes(rel.toLowerCase())) {
      return asText(attrs.href);
    }
  }

  return "";
}

function extractHeadingText(html: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match?.[1] ? htmlToText(match[1]) : "";
}

function extractTitleText(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? htmlToText(match[1]) : "";
}

function normalizeZapProductUrl(href: string, modelId: string): string | null {
  try {
    const url = new URL(decodeHtml(href), "https://www.zap.co.il");
    if (url.origin !== "https://www.zap.co.il" || url.pathname.toLowerCase() !== "/model.aspx") {
      return null;
    }
    if (url.searchParams.get("modelid") !== modelId) {
      return null;
    }
    return `https://www.zap.co.il/model.aspx?modelid=${modelId}`;
  } catch {
    return null;
  }
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(raw)) !== null) {
    const key = match[1]?.toLowerCase();
    if (!key) {
      continue;
    }
    attrs[key] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attrs;
}

function htmlToText(value: string): string {
  return decodeHtml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function hasSchemaType(record: JsonRecord, expected: string): boolean {
  return toArray(record["@type"])
    .map((value) => asText(value).toLowerCase())
    .some((type) => type === expected.toLowerCase() || type.endsWith(`/${expected.toLowerCase()}`));
}

function hasAny(record: JsonRecord, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function namedValue(value: unknown): string {
  if (Array.isArray(value)) {
    return firstText(...value.map((item) => namedValue(item)));
  }
  if (isRecord(value)) {
    return firstText(asText(value.name), asText(value["@id"]));
  }
  return asText(value);
}

function imageValues(value: unknown): string[] {
  const images: string[] = [];
  for (const item of toArray(value)) {
    if (isRecord(item)) {
      const url = safeHttpUrl(firstText(asText(item.url), asText(item.contentUrl)));
      if (url) {
        images.push(url);
      }
      continue;
    }

    const url = safeHttpUrl(asText(item));
    if (url) {
      images.push(url);
    }
  }
  return images;
}

function safeHttpUrl(value: string): string {
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function numericValue(value: unknown): number | undefined {
  const text = asText(value);
  if (!text) {
    return undefined;
  }

  let normalized = text.replace(/[^\d.,-]/g, "");
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/,/g, "");
  } else if (/,/.test(normalized) && /,\d{3}(?:\D|$)/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function assignText<T extends object, K extends keyof T>(target: T, key: K, value: string): void {
  if (value) {
    target[key] = value as T[K];
  }
}

function assignNumber<T extends object, K extends keyof T>(target: T, key: K, value: number | undefined): void {
  if (value !== undefined) {
    target[key] = value as T[K];
  }
}

function firstText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const text = asText(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return decodeHtml(value).replace(/\s+/g, " ").trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
