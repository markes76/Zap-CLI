import { formatCsvRows } from "./output.js";
import type { ExportEnvelope, FeedExportEnvelope, OutputFormat, RssItem, WatchExportEnvelope, WatchItem } from "./types.js";
import { getCategory } from "./categories.js";

export const RSS_ITEM_SCHEMA_VERSION = "zap.rss-item.v1";
export const WATCH_ITEM_SCHEMA_VERSION = "zap.watch-item.v1";

type ExportRow = Record<string, string | number | boolean | null>;
type JsonRow = Record<string, unknown>;

const feedColumns = [
  "schemaVersion",
  "recordType",
  "category",
  "exportedAt",
  "provenance.kind",
  "provenance.source",
  "provenance.sourceUrl",
  "provenance.fetchedAt",
  "id",
  "title",
  "descriptionText",
  "publishedAt",
  "modelId",
  "productUrl",
  "imageUrl"
];

const watchColumns = [
  "schemaVersion",
  "recordType",
  "exportedAt",
  "notesIncluded",
  "provenance.kind",
  "provenance.source",
  "provenance.fetchedAt",
  "id",
  "modelId",
  "title",
  "targetPriceIls",
  "productUrl",
  "specUrl",
  "notes",
  "createdAt"
];

export function createFeedExport(category: string, items: RssItem[], exportedAt = new Date().toISOString()): FeedExportEnvelope {
  const sourceUrl = getCategory(category)?.rssUrl ?? `https://www.zap.co.il/xmls/general/rss.aspx?cat=${encodeURIComponent(category)}`;
  return {
    schemaVersion: RSS_ITEM_SCHEMA_VERSION,
    recordType: "rss_item",
    category,
    exportedAt,
    sourceUrl,
    provenance: {
      kind: "cli_verified",
      source: "official_rss",
      sourceUrl,
      fetchedAt: exportedAt
    },
    items
  };
}

export function createWatchExport(items: WatchItem[], exportedAt = new Date().toISOString(), options: { includeNotes?: boolean } = {}): WatchExportEnvelope {
  const includeNotes = options.includeNotes === true;
  return {
    schemaVersion: WATCH_ITEM_SCHEMA_VERSION,
    recordType: "watch_item",
    exportedAt,
    provenance: {
      kind: "cli_verified",
      source: "watchlist",
      fetchedAt: exportedAt
    },
    notesIncluded: includeNotes,
    items: includeNotes ? items : items.map((item) => ({ ...item, notes: null }))
  };
}

export function isExportEnvelope(value: unknown): value is ExportEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.schemaVersion === RSS_ITEM_SCHEMA_VERSION && record.recordType === "rss_item" && Array.isArray(record.items)) ||
    (record.schemaVersion === WATCH_ITEM_SCHEMA_VERSION && record.recordType === "watch_item" && Array.isArray(record.items))
  );
}

export function formatExportOutput(envelope: ExportEnvelope, format: OutputFormat, selectedFields?: string[]): string {
  if (format === "json") {
    return `${JSON.stringify(selectedFields ? selectEnvelopeItems(envelope, selectedFields) : envelope, null, 2)}\n`;
  }

  if (format === "ndjson") {
    return jsonRows(envelope, selectedFields).map((row) => JSON.stringify(row)).join("\n");
  }

  if (format === "csv") {
    const columns = selectedFields && selectedFields.length > 0 ? selectedFields : envelope.recordType === "rss_item" ? feedColumns : watchColumns;
    return formatCsvRows(csvRows(envelope, selectedFields), columns);
  }

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function selectEnvelopeItems(envelope: ExportEnvelope, selectedFields: string[]): Record<string, unknown> {
  return {
    ...envelope,
    items: envelope.items.map((item) => selectFields(item as unknown as Record<string, unknown>, selectedFields))
  };
}

function jsonRows(envelope: ExportEnvelope, selectedFields: string[] | undefined): JsonRow[] {
  const rows = envelope.recordType === "rss_item" ? envelope.items.map((item) => feedJsonRow(envelope, item)) : envelope.items.map((item) => watchJsonRow(envelope, item));
  return selectedFields && selectedFields.length > 0 ? rows.map((row) => selectFields(row, selectedFields)) : rows;
}

function csvRows(envelope: ExportEnvelope, selectedFields: string[] | undefined): ExportRow[] {
  const rows = envelope.recordType === "rss_item" ? envelope.items.map((item) => feedCsvRow(envelope, item)) : envelope.items.map((item) => watchCsvRow(envelope, item));
  return selectedFields && selectedFields.length > 0 ? rows.map((row) => selectFields(row, selectedFields) as ExportRow) : rows;
}

function selectFields(row: Record<string, unknown>, selectedFields: string[]): Record<string, unknown> {
  const selected: Record<string, unknown> = {};
  for (const field of selectedFields) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      selected[field] = row[field];
    }
  }
  return selected;
}

function feedJsonRow(envelope: FeedExportEnvelope, item: RssItem): JsonRow {
  return {
    schemaVersion: envelope.schemaVersion,
    recordType: envelope.recordType,
    category: envelope.category,
    exportedAt: envelope.exportedAt,
    provenance: envelope.provenance,
    id: item.id,
    title: item.title,
    descriptionText: item.descriptionText,
    publishedAt: item.publishedAt,
    modelId: item.modelId,
    productUrl: item.productUrl,
    imageUrl: item.imageUrl
  };
}

function feedCsvRow(envelope: FeedExportEnvelope, item: RssItem): ExportRow {
  return {
    schemaVersion: envelope.schemaVersion,
    recordType: envelope.recordType,
    category: envelope.category,
    exportedAt: envelope.exportedAt,
    "provenance.kind": envelope.provenance.kind,
    "provenance.source": envelope.provenance.source,
    "provenance.sourceUrl": envelope.provenance.sourceUrl,
    "provenance.fetchedAt": envelope.provenance.fetchedAt,
    id: item.id,
    title: item.title,
    descriptionText: item.descriptionText,
    publishedAt: item.publishedAt,
    modelId: item.modelId,
    productUrl: item.productUrl,
    imageUrl: item.imageUrl
  };
}

function watchJsonRow(envelope: WatchExportEnvelope, item: WatchItem): JsonRow {
  return {
    schemaVersion: envelope.schemaVersion,
    recordType: envelope.recordType,
    exportedAt: envelope.exportedAt,
    notesIncluded: envelope.notesIncluded,
    provenance: envelope.provenance,
    id: item.id,
    modelId: item.modelId,
    title: item.title,
    targetPriceIls: item.targetPriceIls,
    productUrl: item.productUrl,
    specUrl: item.specUrl,
    notes: item.notes,
    createdAt: item.createdAt
  };
}

function watchCsvRow(envelope: WatchExportEnvelope, item: WatchItem): ExportRow {
  return {
    schemaVersion: envelope.schemaVersion,
    recordType: envelope.recordType,
    exportedAt: envelope.exportedAt,
    notesIncluded: envelope.notesIncluded,
    "provenance.kind": envelope.provenance.kind,
    "provenance.source": envelope.provenance.source,
    "provenance.fetchedAt": envelope.provenance.fetchedAt,
    id: item.id,
    modelId: item.modelId,
    title: item.title,
    targetPriceIls: item.targetPriceIls,
    productUrl: item.productUrl,
    specUrl: item.specUrl,
    notes: item.notes,
    createdAt: item.createdAt
  };
}
