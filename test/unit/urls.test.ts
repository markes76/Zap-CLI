import { describe, expect, it } from "vitest";
import { getProductUrls, getSearchUrl, validateModelId } from "../../src/urls.js";

describe("ZAP URL helpers", () => {
  it("validates numeric model ids", () => {
    expect(validateModelId("1253558")).toBe("1253558");
    expect(() => validateModelId("abc")).toThrow(/model id/i);
    expect(() => validateModelId("0")).toThrow(/model id/i);
  });

  it("builds canonical product handoff urls", () => {
    expect(getProductUrls("1253558")).toEqual({
      modelId: "1253558",
      productUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
      reviewsUrl: "https://www.zap.co.il/ratemodel.aspx?modelid=1253558",
      compareUrl: "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
    });
  });

  it("builds but does not fetch official search urls", () => {
    expect(getSearchUrl("iphone 17")).toBe("https://www.zap.co.il/search.aspx?keyword=iphone+17");
  });
});
