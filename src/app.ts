import { homedir } from "node:os";
import { join } from "node:path";
import { aboutZapCli } from "./about.js";
import { categories } from "./categories.js";
import { CliError, exitCodeFor, toErrorEnvelope } from "./errors.js";
import { formatOutput, resolveOutputFormat, selectFields } from "./output.js";
import { inspectProduct } from "./product.js";
import { fetchRssFeed } from "./rss.js";
import { getSchema, listSchemas } from "./schema.js";
import type { CliResult, GlobalOptions, OutputFormat, RunContext, WatchItemInput } from "./types.js";
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
    const data = await dispatch(parsed, env);
    const selected = selectFields(data, parsed.global.select);
    return {
      stdout: parsed.global.quiet ? "" : formatOutput(selected, { format: parsed.global.format }),
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

  if (noun === "feed" && verb === "list") {
    const category = requireFlag(parsed, "category", "Run zap schema get feed-list for command details.");
    const limit = optionalPositiveInt(parsed, "limit", 20);
    return fetchRssFeed(category, { limit, timeoutMs: parsed.global.timeoutMs });
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
      return store.searchRssItems(query, limit);
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
        if (next === undefined || next.startsWith("-")) {
          flags[key] = true;
        } else {
          flags[key] = next;
          index += 1;
        }
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

  const requestedFormat = parseOutputFormat(optionalFlagFromRecord(flags, "output"));
  const timeoutMs = optionalPositiveNumberFromRecord(flags, "timeout", 30) * 1000;
  const select = optionalFlagFromRecord(flags, "select")
    ?.split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const cacheDir = optionalFlagFromRecord(flags, "cache-dir") ?? env.ZAP_CACHE_DIR;
  const global: GlobalOptions = {
    format: resolveOutputFormat(requestedFormat, stdoutIsTTY),
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

function parseOutputFormat(value: string | undefined): OutputFormat | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "json" || value === "text" || value === "ndjson") {
    return value;
  }
  throw new CliError("INVALID_ARGUMENTS", `Unsupported output format "${value}".`, "Use json, text, or ndjson.");
}

function isBooleanFlag(key: string): boolean {
  return key === "quiet" || key === "no-color" || key === "yes" || key === "dry-run" || key === "verbose";
}

async function openStore(options: GlobalOptions, env: NodeJS.ProcessEnv) {
  const { ZapStore } = await import("./store.js");
  return new ZapStore(cachePath(options, env));
}

function cachePath(options: GlobalOptions, env: NodeJS.ProcessEnv): string {
  const cacheDir = options.cacheDir ?? env.ZAP_CACHE_DIR ?? join(homedir(), ".cache", "zap-cli");
  return join(cacheDir, "zap.sqlite");
}
