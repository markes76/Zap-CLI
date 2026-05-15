import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { aboutZapCli } from "./about.js";
import { categories } from "./categories.js";
import { CliError, exitCodeFor, toErrorEnvelope } from "./errors.js";
import { createFeedExport, createWatchExport, formatExportOutput, isExportEnvelope } from "./export.js";
import { formatOutput, resolveOutputFormat, selectFields } from "./output.js";
import { inspectProduct } from "./product.js";
import { fetchRssFeed } from "./rss.js";
import { getSchema, listSchemas } from "./schema.js";
import { buildSearchNextCommands, parseOptionalCategoryFilter, parseSearchSort, parseSyncCategories } from "./search.js";
import type {
  CliResult,
  ExportEnvelope,
  ExportFileResult,
  GlobalOptions,
  OutputFormat,
  RssSearchOptions,
  RunContext,
  SearchSuggestResult,
  SearchSyncResult,
  WatchItemInput
} from "./types.js";
import { getProductUrls, getSearchUrl } from "./urls.js";

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
  global: GlobalOptions;
}

export async function runCli(argv: string[], context: RunContext = {}): Promise<CliResult> {
  const env = context.env ?? process.env;
  const stdoutIsTTY = context.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  try {
    const parsed = parseArgs(argv, stdoutIsTTY, env);
    const outPath = exportOutputPath(parsed, env);
    const data = await dispatch(parsed, env);
    if (outPath && isExportEnvelope(data)) {
      const content = formatExportOutput(data, parsed.global.format, parsed.global.select);
      const result = writeExportFile(outPath, content, data, parsed.global.format);
      return {
        stdout: parsed.global.quiet ? "" : formatOutput(result, { format: "json" }),
        stderr: "",
        exitCode: 0
      };
    }
    const selected = isExportEnvelope(data) ? data : selectFields(data, parsed.global.select);
    return {
      stdout: parsed.global.quiet ? "" : formatCliOutput(selected, parsed.global.format, parsed.global.select),
      stderr: "",
      exitCode: 0
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: `${JSON.stringify(toErrorEnvelope(error), null, 2)}\n`,
      exitCode: exitCodeFor(error)
    };
  }
}

function formatCliOutput(data: unknown, format: OutputFormat, selectedFields?: string[]): string {
  if (isExportEnvelope(data)) {
    return formatExportOutput(data, format, selectedFields);
  }

  return formatOutput(data, { format });
}

function writeExportFile(outPath: string, content: string, envelope: ExportEnvelope, format: OutputFormat): ExportFileResult {
  const outputPath = resolve(outPath);
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new CliError("INVALID_ARGUMENTS", `Output path already exists: ${outputPath}.`, "Choose a new path; overwriting is not supported.");
    }
    throw new CliError("GENERAL_ERROR", error instanceof Error ? error.message : String(error));
  }
  return {
    outputPath,
    format,
    recordType: envelope.recordType,
    itemCount: envelope.items.length,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

async function dispatch(parsed: ParsedArgs, env: NodeJS.ProcessEnv): Promise<unknown> {
  const [noun, verb, ...rest] = parsed.positional;

  if (!noun || noun === "help" || noun === "--help" || noun === "-h") {
    return listSchemas();
  }

  if (noun === "about") {
    return aboutZapCli();
  }

  if (noun === "categories" && verb === "list") {
    return { categories };
  }

  if (noun === "cache" && verb === "info") {
    ensureNoExtraArgs(rest, "cache info");
    return readCacheInfo(parsed.global, env);
  }

  if (noun === "feed" && verb === "list") {
    const category = requireFlag(parsed, "category", "Run zap schema get feed-list for command details.");
    const limit = optionalPositiveInt(parsed, "limit", 20);
    return fetchRssFeed(category, { limit, timeoutMs: parsed.global.timeoutMs });
  }

  if (noun === "feed" && verb === "export") {
    ensureNoExtraArgs(rest, "feed export");
    const category = requireFlag(parsed, "category", "Run zap schema get feed-export for command details.");
    const limit = optionalPositiveInt(parsed, "limit", 20);
    const items = await fetchRssFeed(category, { limit, timeoutMs: parsed.global.timeoutMs });
    return createFeedExport(category, items);
  }

  if (noun === "feed" && verb === "sync") {
    const category = requireFlag(parsed, "category", "Run zap schema get feed-sync for command details.");
    const limit = optionalPositiveInt(parsed, "limit", 20);
    const items = await fetchRssFeed(category, { limit, timeoutMs: parsed.global.timeoutMs });
    const store = await openStore(parsed.global, env);
    try {
      const synced = store.upsertRssItems(items);
      return { category, synced, cachePath: cachePath(parsed.global, env) };
    } finally {
      store.close();
    }
  }

  if (noun === "feed" && verb === "search") {
    const query = rest.join(" ").trim();
    if (!query) {
      throw new CliError("INVALID_ARGUMENTS", "Missing feed search query.", "Usage: zap feed search Wiim --limit 10.");
    }
    const limit = optionalPositiveInt(parsed, "limit", 20);
    const store = await openStore(parsed.global, env);
    try {
      return store.searchRssItems(query, { limit, sort: "newest" });
    } finally {
      store.close();
    }
  }

  if (noun === "product" && verb === "url") {
    const modelId = requireFlag(parsed, "model-id", "Run zap schema get product-url for command details.");
    return getProductUrls(modelId);
  }

  if (noun === "product" && verb === "inspect") {
    const modelId = requireFlag(parsed, "model-id", "Run zap schema get product-inspect for command details.");
    return inspectProduct(modelId, { timeoutMs: parsed.global.timeoutMs });
  }

  if (noun === "search" && verb === "url") {
    const query = rest.join(" ").trim();
    return {
      query,
      searchUrl: getSearchUrl(query),
      fetched: false
    };
  }

  if (noun === "search" && verb === "sync") {
    const categoryInput = requireFlag(parsed, "category", "Run zap schema get search-sync for command details.");
    const categoryIds = parseSyncCategories(categoryInput);
    const limit = optionalPositiveInt(parsed, "limit", 20);
    const store = await openStore(parsed.global, env);
    const perCategory: SearchSyncResult["perCategory"] = [];
    try {
      for (const category of categoryIds) {
        const items = await fetchRssFeed(category, { limit, timeoutMs: parsed.global.timeoutMs });
        const synced = store.upsertRssItems(items);
        perCategory.push({ category, synced });
      }
      return {
        categories: categoryIds,
        synced: perCategory.reduce((total, item) => total + item.synced, 0),
        perCategory,
        cachePath: cachePath(parsed.global, env)
      } satisfies SearchSyncResult;
    } finally {
      store.close();
    }
  }

  if (noun === "search" && verb === "local") {
    const query = rest.join(" ").trim();
    if (!query) {
      throw new CliError("INVALID_ARGUMENTS", "Missing local search query.", "Usage: zap search local Wiim --limit 10.");
    }
    const categories = parseOptionalCategoryFilter(optionalFlag(parsed, "category"));
    const limit = optionalPositiveInt(parsed, "limit", 20);
    const sort = parseSearchSort(optionalFlag(parsed, "sort"));
    const searchOptions: RssSearchOptions = { limit, sort, ...(categories ? { categories } : {}) };
    const store = await openStore(parsed.global, env);
    try {
      return store.searchRssItems(query, searchOptions);
    } finally {
      store.close();
    }
  }

  if (noun === "search" && verb === "suggest") {
    const query = rest.join(" ").trim();
    if (!query) {
      throw new CliError("INVALID_ARGUMENTS", "Missing search suggest query.", "Usage: zap search suggest Wiim --limit 10.");
    }
    const categories = parseOptionalCategoryFilter(optionalFlag(parsed, "category"));
    const limit = optionalPositiveInt(parsed, "limit", 5);
    const searchOptions: RssSearchOptions = { limit, sort: "relevance", ...(categories ? { categories } : {}) };
    const nextCommands = buildSearchNextCommands(query, categories, limit);
    const databasePath = cachePath(parsed.global, env);
    if (!existsSync(databasePath)) {
      return {
        query,
        searchUrl: getSearchUrl(query),
        fetched: false,
        cacheStatus: "empty",
        cacheResults: [],
        nextCommands
      } satisfies SearchSuggestResult;
    }

    let store: Awaited<ReturnType<typeof openStore>> | undefined;
    try {
      store = await openStore(parsed.global, env, { readOnly: true });
      return {
        query,
        searchUrl: getSearchUrl(query),
        fetched: false,
        cacheStatus: "searched",
        cacheResults: store.searchRssItems(query, searchOptions),
        nextCommands
      } satisfies SearchSuggestResult;
    } catch {
      return {
        query,
        searchUrl: getSearchUrl(query),
        fetched: false,
        cacheStatus: "unavailable",
        cacheResults: [],
        cacheWarnings: ["Local cache could not be read; returned handoff URL only."],
        nextCommands
      } satisfies SearchSuggestResult;
    } finally {
      store?.close();
    }
  }

  if (noun === "watch" && verb === "add") {
    const modelId = requireFlag(parsed, "model-id", "Run zap schema get watch-add for command details.");
    const title = optionalFlag(parsed, "title");
    const targetPriceIls = optionalNumber(parsed, "target-price");
    const notes = optionalFlag(parsed, "notes");
    const input: WatchItemInput = {
      modelId,
      ...(title !== undefined ? { title } : {}),
      ...(targetPriceIls !== undefined ? { targetPriceIls } : {}),
      ...(notes !== undefined ? { notes } : {})
    };
    const store = await openStore(parsed.global, env);
    try {
      return store.addWatchItem(input);
    } finally {
      store.close();
    }
  }

  if (noun === "watch" && verb === "list") {
    const store = await openStore(parsed.global, env);
    try {
      return store.listWatchItems();
    } finally {
      store.close();
    }
  }

  if (noun === "watch" && verb === "export") {
    ensureNoExtraArgs(rest, "watch export");
    const databasePath = cachePath(parsed.global, env);
    const includeNotes = optionalBooleanFlag(parsed, "include-notes");
    if (!existsSync(databasePath)) {
      return createWatchExport([], undefined, { includeNotes });
    }

    const store = await openStore(parsed.global, env, { readOnly: true });
    try {
      return createWatchExport(store.listWatchItems(), undefined, { includeNotes });
    } finally {
      store.close();
    }
  }

  if (noun === "watch" && verb === "remove") {
    const id = requireFlag(parsed, "id", "Run zap schema get watch-remove for command details.");
    const store = await openStore(parsed.global, env);
    try {
      return { id, removed: store.removeWatchItem(id) };
    } finally {
      store.close();
    }
  }

  if (noun === "schema" && verb === "list") {
    return listSchemas();
  }

  if (noun === "schema" && verb === "get") {
    const key = rest.join(" ").trim();
    if (!key) {
      throw new CliError("INVALID_ARGUMENTS", "Missing schema key.", "Usage: zap schema get product-url.");
    }
    const schema = getSchema(key);
    if (!schema) {
      throw new CliError("NOT_FOUND", `Unknown schema "${key}".`, "Run zap schema list.");
    }
    return schema;
  }

  throw new CliError("INVALID_ARGUMENTS", `Unknown command "${parsed.positional.join(" ")}".`, "Run zap schema list.");
}

function parseArgs(argv: string[], stdoutIsTTY: boolean, env: NodeJS.ProcessEnv): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const [rawKey, rawValue] = arg.slice(2).split("=", 2);
      const key = rawKey;
      if (!key) {
        continue;
      }
      if (rawValue !== undefined) {
        flags[key] = rawValue;
      } else if (isBooleanFlag(key)) {
        flags[key] = true;
      } else {
        const next = argv[index + 1];
        if (next === undefined || isOptionToken(next)) {
          throw new CliError("INVALID_ARGUMENTS", `Missing value for --${key}.`, `Pass a value after --${key} or use --${key}=<value>.`);
        }
        flags[key] = next;
        index += 1;
      }
      continue;
    }

    if (arg === "-o") {
      const next = argv[index + 1];
      if (!next) {
        throw new CliError("INVALID_ARGUMENTS", "Missing value for -o.", "Use -o json, -o text, or -o ndjson.");
      }
      flags.output = next;
      index += 1;
      continue;
    }

    if (arg === "-q") {
      flags.quiet = true;
      continue;
    }

    positional.push(arg);
  }

  const outputPolicy = outputFormatPolicy(positional);
  const requestedFormat = parseOutputFormat(optionalFlagFromRecord(flags, "output"), outputPolicy);
  const timeoutMs = optionalPositiveNumberFromRecord(flags, "timeout", 30) * 1000;
  const select = optionalFlagFromRecord(flags, "select")
    ?.split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const cacheDir = optionalFlagFromRecord(flags, "cache-dir") ?? env.ZAP_CACHE_DIR;
  const global: GlobalOptions = {
    format: requestedFormat ?? outputPolicy.defaultFormat ?? resolveOutputFormat(requestedFormat, stdoutIsTTY),
    quiet: flags.quiet === true,
    timeoutMs,
    noColor: flags["no-color"] === true,
    ...(cacheDir ? { cacheDir } : {}),
    ...(select && select.length > 0 ? { select } : {})
  };

  return {
    positional,
    flags,
    global
  };
}

function requireFlag(parsed: ParsedArgs, name: string, hint: string): string {
  const value = optionalFlag(parsed, name);
  if (!value) {
    throw new CliError("INVALID_ARGUMENTS", `Missing required flag --${name}.`, hint);
  }
  return value;
}

function optionalFlag(parsed: ParsedArgs, name: string): string | undefined {
  return optionalFlagFromRecord(parsed.flags, name);
}

function optionalFlagFromRecord(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function optionalPositiveInt(parsed: ParsedArgs, name: string, defaultValue: number): number {
  const value = optionalNumber(parsed, name);
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new CliError("INVALID_ARGUMENTS", `--${name} must be a positive integer.`);
  }
  return value;
}

function optionalNumber(parsed: ParsedArgs, name: string): number | undefined {
  const raw = optionalFlag(parsed, name);
  if (raw === undefined) {
    return undefined;
  }
  const numberValue = Number(raw);
  if (!Number.isFinite(numberValue)) {
    throw new CliError("INVALID_ARGUMENTS", `--${name} must be a number.`);
  }
  return numberValue;
}

function optionalBooleanFlag(parsed: ParsedArgs, name: string): boolean {
  const value = parsed.flags[name];
  if (value === undefined) {
    return false;
  }
  if (value === true) {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new CliError("INVALID_ARGUMENTS", `--${name} must be true or false when a value is provided.`);
}

function ensureNoExtraArgs(rest: string[], commandName: string): void {
  if (rest.length > 0) {
    throw new CliError("INVALID_ARGUMENTS", `Unexpected argument "${rest[0]}" for ${commandName}.`);
  }
}

async function readCacheInfo(options: GlobalOptions, env: NodeJS.ProcessEnv) {
  const path = cachePath(options, env);
  if (!existsSync(path)) {
    return {
      cachePath: path,
      exists: false,
      readable: false,
      rssItemCount: 0,
      watchItemCount: 0,
      categories: []
    };
  }

  let store: Awaited<ReturnType<typeof openStore>> | undefined;
  try {
    store = await openStore(options, env, { readOnly: true });
    return {
      cachePath: path,
      exists: true,
      readable: true,
      rssItemCount: store.countRssItems(),
      watchItemCount: store.countWatchItems(),
      categories: store.listRssCategoryInfo()
    };
  } catch {
    return {
      cachePath: path,
      exists: true,
      readable: false,
      rssItemCount: 0,
      watchItemCount: 0,
      categories: []
    };
  } finally {
    store?.close();
  }
}

function optionalPositiveNumberFromRecord(flags: Record<string, string | boolean>, name: string, defaultValue: number): number {
  const raw = optionalFlagFromRecord(flags, name);
  if (raw === undefined) {
    return defaultValue;
  }
  const numberValue = Number(raw);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new CliError("INVALID_ARGUMENTS", `--${name} must be a positive number.`);
  }
  return numberValue;
}

interface OutputFormatPolicy {
  allowed: OutputFormat[];
  commandName?: string;
  defaultFormat?: OutputFormat;
}

function outputFormatPolicy(positional: string[]): OutputFormatPolicy {
  const [noun, verb] = positional;
  if (noun === "feed" && verb === "export") {
    return { allowed: ["json", "ndjson", "csv"], commandName: "feed export", defaultFormat: "json" };
  }
  if (noun === "watch" && verb === "export") {
    return { allowed: ["json", "csv"], commandName: "watch export", defaultFormat: "json" };
  }
  return { allowed: ["json", "text", "ndjson"] };
}

function isExportCommand(positional: string[]): boolean {
  const [noun, verb] = positional;
  return (noun === "feed" && verb === "export") || (noun === "watch" && verb === "export");
}

function exportOutputPath(parsed: ParsedArgs, env: NodeJS.ProcessEnv): string | undefined {
  if (!hasFlag(parsed.flags, "out")) {
    return undefined;
  }

  if (!isExportCommand(parsed.positional)) {
    throw new CliError("INVALID_ARGUMENTS", "--out is only supported for export commands.", "Use feed export or watch export.");
  }

  const outPath = optionalFlagFromRecord(parsed.flags, "out");
  if (!outPath || outPath.trim().length === 0) {
    throw new CliError("INVALID_ARGUMENTS", "--out requires a non-empty path.", "Use --out <path>.");
  }

  const outputPath = resolve(outPath);
  const activeCachePath = resolve(cachePath(parsed.global, env));
  if (outputPath === activeCachePath) {
    throw new CliError("INVALID_ARGUMENTS", "--out must not target the active cache database.", "Choose a separate export file path.");
  }
  if (existsSync(outputPath)) {
    throw new CliError("INVALID_ARGUMENTS", `Output path already exists: ${outputPath}.`, "Choose a new path; overwriting is not supported.");
  }

  return outputPath;
}

function hasFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(flags, name);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseOutputFormat(value: string | undefined, policy: OutputFormatPolicy): OutputFormat | undefined {
  if (!value) {
    return undefined;
  }

  const format = toOutputFormat(value);
  if (format && policy.allowed.includes(format)) {
    return format;
  }

  const commandSuffix = policy.commandName ? ` for ${policy.commandName}` : "";
  throw new CliError("INVALID_ARGUMENTS", `Unsupported output format "${value}"${commandSuffix}.`, outputFormatHint(policy.allowed));
}

function toOutputFormat(value: string): OutputFormat | undefined {
  if (value === "json" || value === "text" || value === "ndjson" || value === "csv") {
    return value;
  }
  return undefined;
}

function outputFormatHint(formats: OutputFormat[]): string {
  if (formats.length === 1) {
    return `Use ${formats[0]}.`;
  }

  const last = formats[formats.length - 1];
  const rest = formats.slice(0, -1).join(", ");
  return formats.length === 2 ? `Use ${rest} or ${last}.` : `Use ${rest}, or ${last}.`;
}

function isBooleanFlag(key: string): boolean {
  return (
    key === "quiet" ||
    key === "no-color" ||
    key === "yes" ||
    key === "dry-run" ||
    key === "verbose" ||
    key === "help" ||
    key === "include-notes"
  );
}

function isOptionToken(value: string): boolean {
  return value.startsWith("--") || value === "-o" || value === "-q" || value === "-h";
}

async function openStore(options: GlobalOptions, env: NodeJS.ProcessEnv, storeOptions: { readOnly?: boolean } = {}) {
  const { ZapStore } = await import("./store.js");
  return new ZapStore(cachePath(options, env), storeOptions);
}

function cachePath(options: GlobalOptions, env: NodeJS.ProcessEnv): string {
  const cacheDir = options.cacheDir ?? env.ZAP_CACHE_DIR ?? join(homedir(), ".cache", "zap-cli");
  return join(cacheDir, "zap.sqlite");
}
