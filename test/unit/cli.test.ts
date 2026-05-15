import { describe, expect, it } from "vitest";
import { runCli } from "../../src/app.js";

describe("runCli", () => {
  it("returns schema list as JSON data", async () => {
    const result = await runCli(["schema", "list", "--output", "json"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        commands: expect.arrayContaining([expect.objectContaining({ name: "feed list" })])
      })
    );
  });

  it("returns exit code 2 and JSON error for invalid args", async () => {
    const result = await runCli(["product", "url"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Missing required flag --model-id.",
        hint: "Run zap schema get product-url for command details."
      }
    });
  });

  it("prints search urls without fetching blocked search pages", async () => {
    const result = await runCli(["search", "url", "iphone 17", "--output", "json"], { stdoutIsTTY: false });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      query: "iphone 17",
      searchUrl: "https://www.zap.co.il/search.aspx?keyword=iphone+17",
      fetched: false
    });
  });
});
