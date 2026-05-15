import { CliError } from "./errors.js";
import type { ProductUrls } from "./types.js";

const ZAP_BASE_URL = "https://www.zap.co.il";

export function validateModelId(modelId: string): string {
  const normalized = modelId.trim();
  if (!/^[1-9]\d{0,11}$/.test(normalized)) {
    throw new CliError("INVALID_ARGUMENTS", `Invalid model id "${modelId}".`, "Use a numeric ZAP model id such as 1253558.");
  }
  return normalized;
}

export function getProductUrls(modelIdInput: string): ProductUrls {
  const modelId = validateModelId(modelIdInput);
  return {
    modelId,
    productUrl: `${ZAP_BASE_URL}/model.aspx?modelid=${modelId}`,
    reviewsUrl: `${ZAP_BASE_URL}/ratemodel.aspx?modelid=${modelId}`,
    compareUrl: `${ZAP_BASE_URL}/compmodels.aspx?modelid=${modelId}`
  };
}

export function getSearchUrl(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new CliError("INVALID_ARGUMENTS", "Missing search query.", "Usage: zap search url \"iphone 17\".");
  }
  const encoded = new URLSearchParams({ keyword: trimmed }).toString();
  return `${ZAP_BASE_URL}/search.aspx?${encoded}`;
}

export function extractModelId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const modelId = parsed.searchParams.get("modelid");
    return modelId ? validateModelId(modelId) : null;
  } catch {
    return null;
  }
}
