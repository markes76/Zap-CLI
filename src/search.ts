import { categories, requireCategory } from "./categories.js";
import { CliError } from "./errors.js";
import type { SearchNextCommand, SearchSort } from "./types.js";

export function parseSyncCategories(input: string): string[] {
  const normalized = input.trim();
  if (normalized === "all") {
    return categories.map((category) => category.id);
  }
  return parseCategoryList(normalized);
}

export function parseOptionalCategoryFilter(input: string | undefined): string[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  return parseCategoryList(input.trim());
}

export function parseSearchSort(input: string | undefined): SearchSort {
  if (input === undefined || input === "relevance") {
    return "relevance";
  }
  if (input === "newest") {
    return "newest";
  }
  throw new CliError("INVALID_ARGUMENTS", `Unsupported search sort "${input}".`, "Use relevance or newest.");
}

export function buildSearchNextCommands(query: string, categories: string[] | undefined, limit: number): SearchNextCommand[] {
  const localArgv = ["zap", "search", "local", query];
  if (categories && categories.length > 0) {
    localArgv.push("--category", categories.join(","));
  }
  localArgv.push("--limit", String(limit));

  return [
    {
      command: "search local",
      argv: localArgv
    },
    {
      command: "search url",
      argv: ["zap", "search", "url", query]
    }
  ];
}

function parseCategoryList(input: string): string[] {
  const rawIds = input
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);

  if (rawIds.length === 0) {
    throw new CliError("INVALID_ARGUMENTS", "Missing RSS category.", "Use a category id, comma-separated ids, or all for search sync.");
  }

  const seen = new Set<string>();
  const categoryIds: string[] = [];
  for (const rawId of rawIds) {
    const id = requireCategory(rawId).id;
    if (!seen.has(id)) {
      seen.add(id);
      categoryIds.push(id);
    }
  }
  return categoryIds;
}
