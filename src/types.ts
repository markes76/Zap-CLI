export type OutputFormat = "json" | "text" | "ndjson";

export interface RssItem {
  id: string;
  title: string;
  descriptionText: string;
  category: string;
  publishedAt: string;
  modelId: string;
  productUrl: string;
  imageUrl: string | null;
}

export type SearchSort = "relevance" | "newest";

export interface RssSearchOptions {
  limit?: number;
  categories?: string[];
  sort?: SearchSort;
}

export interface SearchSyncCategoryResult {
  category: string;
  synced: number;
}

export interface SearchSyncResult {
  categories: string[];
  synced: number;
  perCategory: SearchSyncCategoryResult[];
  cachePath: string;
}

export interface SearchNextCommand {
  command: string;
  argv: string[];
}

export interface SearchSuggestResult {
  query: string;
  searchUrl: string;
  fetched: false;
  cacheStatus: "empty" | "searched" | "unavailable";
  cacheResults: RssItem[];
  cacheWarnings?: string[];
  nextCommands: SearchNextCommand[];
}

export interface ProductUrls {
  modelId: string;
  productUrl: string;
  reviewsUrl: string;
  compareUrl: string;
}

export interface JsonLdProductFields {
  name?: string;
  description?: string;
  brand?: string;
  sku?: string;
  mpn?: string;
  gtin?: string;
  image?: string[];
  url?: string;
}

export interface ProductOffer {
  sellerName?: string;
  price?: number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
}

export interface ProductAggregateOffer {
  lowPrice?: number;
  highPrice?: number;
  offerCount?: number;
  priceCurrency?: string;
  offers?: ProductOffer[];
}

export interface ProductInspectionLinks {
  canonicalUrl: string;
  reviewsUrl: string;
  specUrl: string;
}

export interface ProductVendorCard {
  vendorName: string;
  priceIls: number;
  shippingText?: string;
  availabilityText?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ProductInspection {
  sourceUrl: string;
  fetchedAt: string;
  modelId: string;
  title?: string;
  jsonLdProduct?: JsonLdProductFields;
  aggregateOffer?: ProductAggregateOffer;
  links: ProductInspectionLinks;
  vendorCards: ProductVendorCard[];
  warnings: string[];
}

export interface WatchItem {
  id: string;
  modelId: string;
  title: string | null;
  targetPriceIls: number | null;
  productUrl: string;
  specUrl: string;
  notes: string | null;
  createdAt: string;
}

export interface WatchItemInput {
  modelId: string;
  title?: string | null;
  targetPriceIls?: number | null;
  notes?: string | null;
}

export interface GlobalOptions {
  format: OutputFormat;
  quiet: boolean;
  timeoutMs: number;
  cacheDir?: string;
  noColor: boolean;
  select?: string[];
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunContext {
  stdoutIsTTY?: boolean;
  env?: NodeJS.ProcessEnv;
}
