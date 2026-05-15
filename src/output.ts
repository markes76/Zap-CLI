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

  if (options.format === "csv") {
    const rows = Array.isArray(data) ? objectRows(data) : objectRows([data]);
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return formatCsvRows(rows, columns);
  }

  return formatText(data);
}

export type CsvScalar = string | number | boolean | null | undefined;

export function formatCsvRows(rows: Array<Record<string, CsvScalar>>, columns: string[]): string {
  const lines = [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","))
  ];
  return `${lines.join("\n")}\n`;
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

function objectRows(values: unknown[]): Array<Record<string, CsvScalar>> {
  const rows: Array<Record<string, CsvScalar>> = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    rows.push(value as Record<string, CsvScalar>);
  }
  return rows;
}

function escapeCsvValue(value: CsvScalar): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = formulaSafeCsvText(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function formulaSafeCsvText(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
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
