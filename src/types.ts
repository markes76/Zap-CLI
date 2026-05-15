export type OutputFormat = "json" | "text" | "ndjson" | "csv";

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

export type ExportRecordType = "rss_item" | "watch_item";

export interface ExportProvenance {
  kind: "cli_verified";
  source: "official_rss" | "watchlist";
  sourceUrl?: string;
  fetchedAt: string;
}

export interface FeedExportEnvelope {
  schemaVersion: string;
  recordType: "rss_item";
  category: string;
  exportedAt: string;
  sourceUrl: string;
  provenance: ExportProvenance & { source: "official_rss"; sourceUrl: string };
  items: RssItem[];
}

export interface WatchExportEnvelope {
  schemaVersion: string;
  recordType: "watch_item";
  exportedAt: string;
  provenance: ExportProvenance & { source: "watchlist" };
  notesIncluded: boolean;
  items: WatchItem[];
}

export type ExportEnvelope = FeedExportEnvelope | WatchExportEnvelope;

export interface ExportFileResult {
  outputPath: string;
  format: OutputFormat;
  recordType: ExportRecordType;
  itemCount: number;
  bytes: number;
}

export interface CacheCategoryInfo {
  category: string;
  count: number;
  newestPublishedAt: string | null;
}

export interface CacheInfo {
  cachePath: string;
  exists: boolean;
  readable: boolean;
  rssItemCount: number;
  watchItemCount: number;
  categories: CacheCategoryInfo[];
}

export interface AgentPreference {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AgentFeedback {
  id: string;
  command: string;
  rating: number | null;
  outputFormat: OutputFormat | null;
  notes: string | null;
  createdAt: string;
}

export interface AgentFeedbackInput {
  command: string;
  rating?: number | null;
  outputFormat?: OutputFormat | null;
  notes?: string | null;
}

export interface AgentFeedbackSummary {
  count: number;
  averageRating: number | null;
  preferredOutputFormat: OutputFormat | null;
  topCommands: Array<{ command: string; count: number }>;
}

export interface AgentSuggestionResult {
  cachePath: string;
  preferences: AgentPreference[];
  feedbackSummary: AgentFeedbackSummary;
  recommendations: string[];
  skillDraft: string[];
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
