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

export interface ProductUrls {
  modelId: string;
  productUrl: string;
  reviewsUrl: string;
  compareUrl: string;
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
