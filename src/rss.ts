import { XMLParser } from "fast-xml-parser";
import { requireCategory } from "./categories.js";
import { CliError } from "./errors.js";
import type { RssItem } from "./types.js";
import { extractModelId } from "./urls.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  processEntities: true
});

export interface FetchRssOptions {
  limit?: number;
  timeoutMs?: number;
}

export function parseRssFeed(xml: string, category: string): RssItem[] {
  const parsed = parser.parse(xml) as unknown;
  const channel = readPath<Record<string, unknown>>(parsed, ["rss", "channel"]);
  if (!channel) {
    return [];
  }

  const rawItems = toArray(channel.item);
  return rawItems.flatMap((rawItem) => normalizeItem(rawItem, category));
}

export async function fetchRssFeed(categoryId: string, options: FetchRssOptions = {}): Promise<RssItem[]> {
  const category = requireCategory(categoryId);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(category.rssUrl, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      headers: {
        "user-agent": "zap-cli/0.1 consent-safe RSS reader"
      }
    });

    if (!response.ok) {
      throw new CliError("REMOTE_API_ERROR", `ZAP RSS returned HTTP ${response.status}.`, category.rssUrl);
    }

    const xml = await response.text();
    const items = parseRssFeed(xml, category.id);
    return typeof options.limit === "number" ? items.slice(0, options.limit) : items;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError("NETWORK_ERROR", "Failed to fetch official ZAP RSS feed.", category.rssUrl);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItem(rawItem: unknown, category: string): RssItem[] {
  if (!rawItem || typeof rawItem !== "object") {
    return [];
  }

  const item = rawItem as Record<string, unknown>;
  const link = asText(item.link);
  const modelId = link ? extractModelId(link) : null;
  if (!link || !modelId) {
    return [];
  }

  const title = asText(item.title);
  const descriptionRaw = asText(item.description);
  const imageUrl = imageUrlFromItem(item, descriptionRaw);
  const publishedAt = parseDate(asText(item.pubDate));

  return [
    {
      id: modelId,
      title,
      descriptionText: htmlToText(descriptionRaw),
      category,
      publishedAt,
      modelId,
      productUrl: link,
      imageUrl
    }
  ];
}

function imageUrlFromItem(item: Record<string, unknown>, descriptionRaw: string): string | null {
  const imageObject = item.image;
  if (imageObject && typeof imageObject === "object") {
    const url = asText((imageObject as Record<string, unknown>).url);
    if (url) {
      return url;
    }
  }

  const match = descriptionRaw.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function htmlToText(value: string): string {
  return decodeHtml(value)
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
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

function readPath<T>(value: unknown, path: string[]): T | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current as T;
}
