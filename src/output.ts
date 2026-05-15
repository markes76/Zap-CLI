import type { OutputFormat } from "./types.js";

export interface FormatOptions {
  format: OutputFormat;
}

export function resolveOutputFormat(requested: OutputFormat | undefined, stdoutIsTTY: boolean): OutputFormat {
  return requested ?? (stdoutIsTTY ? "text" : "json");
}

export function formatOutput(data: unknown, options: FormatOptions): string {
  if (options.format === "json") {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  if (options.format === "ndjson") {
    const rows = Array.isArray(data) ? data : [data];
    return rows.map((row) => JSON.stringify(row)).join("\n");
  }

  return formatText(data);
}

export function selectFields(data: unknown, fields: string[] | undefined): unknown {
  if (!fields || fields.length === 0) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => selectObjectFields(item, fields));
  }

  return selectObjectFields(data, fields);
}

function selectObjectFields(data: unknown, fields: string[]): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  const selected: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      selected[field] = record[field];
    }
  }
  return selected;
}

function formatText(data: unknown): string {
  if (typeof data === "string") {
    return `${data}\n`;
  }

  if (Array.isArray(data)) {
    return `${data.map((item) => rowToText(item)).join("\n")}\n`;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.commands)) {
      return `${record.commands.map((command) => rowToText(command)).join("\n")}\n`;
    }
    return `${Object.entries(record)
      .map(([key, value]) => `${key}: ${valueToText(value)}`)
      .join("\n")}\n`;
  }

  return `${String(data)}\n`;
}

function rowToText(item: unknown): string {
  if (!item || typeof item !== "object") {
    return String(item);
  }

  const record = item as Record<string, unknown>;
  if (typeof record.title === "string" && typeof record.productUrl === "string") {
    return `${record.title} - ${record.productUrl}`;
  }
  if (typeof record.name === "string" && typeof record.description === "string") {
    return `${record.name} - ${record.description}`;
  }
  if (typeof record.id === "string" && typeof record.productUrl === "string") {
    return `${record.id} - ${record.productUrl}`;
  }
  return JSON.stringify(record);
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
