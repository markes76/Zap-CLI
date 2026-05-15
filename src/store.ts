import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { CacheCategoryInfo, RssItem, RssSearchOptions, WatchItem, WatchItemInput } from "./types.js";
import { getProductUrls, validateModelId } from "./urls.js";

export class ZapStore {
  private readonly db: DatabaseSync;

  constructor(databasePath: string, options: { readOnly?: boolean } = {}) {
    if (!options.readOnly) {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.db = new DatabaseSync(databasePath, options.readOnly ? { readOnly: true } : {});
    if (!options.readOnly) {
      this.migrate();
    }
  }

  close(): void {
    this.db.close();
  }

  upsertRssItems(items: RssItem[]): number {
    const upsert = this.db.prepare(`
      INSERT INTO rss_items (
        id, title, description_text, category, published_at, model_id, product_url, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description_text = excluded.description_text,
        category = excluded.category,
        published_at = excluded.published_at,
        model_id = excluded.model_id,
        product_url = excluded.product_url,
        image_url = excluded.image_url
    `);
    const deleteFts = this.db.prepare("DELETE FROM rss_items_fts WHERE id = ?");
    const insertFts = this.db.prepare("INSERT INTO rss_items_fts (id, title, description_text) VALUES (?, ?, ?)");

    this.db.exec("BEGIN");
    try {
      for (const item of items) {
        upsert.run(item.id, item.title, item.descriptionText, item.category, item.publishedAt, item.modelId, item.productUrl, item.imageUrl);
        deleteFts.run(item.id);
        insertFts.run(item.id, item.title, item.descriptionText);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return items.length;
  }

  searchRssItems(query: string, limit: number): RssItem[];
  searchRssItems(query: string, options: RssSearchOptions): RssItem[];
  searchRssItems(query: string, limitOrOptions: number | RssSearchOptions): RssItem[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
    const limit = options.limit ?? 20;
    const categories = options.categories ?? [];
    const sort = options.sort ?? "newest";

    const matchQuery = trimmed
      .split(/\s+/)
      .map((token) => `"${token.replace(/"/g, "\"\"")}"`)
      .join(" ");
    const categoryFilter = categories.length > 0 ? `AND r.category IN (${categories.map(() => "?").join(", ")})` : "";
    const orderBy =
      sort === "relevance" ? "bm25(rss_items_fts, 0.0, 6.0, 1.0), r.published_at DESC, r.id ASC" : "r.published_at DESC, r.id ASC";
    const params: Array<string | number> = [matchQuery, ...categories, limit];

    const rows = this.db
      .prepare(
        `
        SELECT r.*
        FROM rss_items_fts
        JOIN rss_items r ON r.id = rss_items_fts.id
        WHERE rss_items_fts MATCH ?
        ${categoryFilter}
        ORDER BY ${orderBy}
        LIMIT ?
      `
      )
      .all(...params) as unknown as RssRow[];

    return rows.map(rssRowToItem);
  }

  addWatchItem(input: WatchItemInput): WatchItem {
    const modelId = validateModelId(input.modelId);
    const urls = getProductUrls(modelId);
    const item: WatchItem = {
      id: randomUUID(),
      modelId,
      title: input.title ?? null,
      targetPriceIls: input.targetPriceIls ?? null,
      productUrl: urls.productUrl,
      specUrl: urls.compareUrl,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `
        INSERT INTO watch_items (
          id, model_id, title, target_price_ils, product_url, spec_url, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(item.id, item.modelId, item.title, item.targetPriceIls, item.productUrl, item.specUrl, item.notes, item.createdAt);

    return item;
  }

  listWatchItems(): WatchItem[] {
    const rows = this.db.prepare("SELECT * FROM watch_items ORDER BY created_at DESC").all() as unknown as WatchRow[];
    return rows.map(watchRowToItem);
  }

  countRssItems(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM rss_items").get() as unknown as CountRow;
    return row.count;
  }

  countWatchItems(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM watch_items").get() as unknown as CountRow;
    return row.count;
  }

  listRssCategoryInfo(): CacheCategoryInfo[] {
    const rows = this.db
      .prepare(
        `
        SELECT category, COUNT(*) AS count, MAX(published_at) AS newest_published_at
        FROM rss_items
        GROUP BY category
        ORDER BY category ASC
      `
      )
      .all() as unknown as CategoryInfoRow[];

    return rows.map((row) => ({
      category: row.category,
      count: row.count,
      newestPublishedAt: row.newest_published_at
    }));
  }

  removeWatchItem(id: string): boolean {
    const result = this.db.prepare("DELETE FROM watch_items WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rss_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description_text TEXT NOT NULL,
        category TEXT NOT NULL,
        published_at TEXT NOT NULL,
        model_id TEXT NOT NULL,
        product_url TEXT NOT NULL,
        image_url TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS rss_items_fts
      USING fts5(id UNINDEXED, title, description_text);

      CREATE TABLE IF NOT EXISTS watch_items (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        title TEXT,
        target_price_ils REAL,
        product_url TEXT NOT NULL,
        spec_url TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
}

interface RssRow {
  id: string;
  title: string;
  description_text: string;
  category: string;
  published_at: string;
  model_id: string;
  product_url: string;
  image_url: string | null;
}

interface WatchRow {
  id: string;
  model_id: string;
  title: string | null;
  target_price_ils: number | null;
  product_url: string;
  spec_url: string;
  notes: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface CategoryInfoRow {
  category: string;
  count: number;
  newest_published_at: string | null;
}

function rssRowToItem(row: RssRow): RssItem {
  return {
    id: row.id,
    title: row.title,
    descriptionText: row.description_text,
    category: row.category,
    publishedAt: row.published_at,
    modelId: row.model_id,
    productUrl: row.product_url,
    imageUrl: row.image_url
  };
}

function watchRowToItem(row: WatchRow): WatchItem {
  return {
    id: row.id,
    modelId: row.model_id,
    title: row.title,
    targetPriceIls: row.target_price_ils,
    productUrl: row.product_url,
    specUrl: row.spec_url,
    notes: row.notes,
    createdAt: row.created_at
  };
}
