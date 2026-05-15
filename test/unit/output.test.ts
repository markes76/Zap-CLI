import { describe, expect, it } from "vitest";
import { formatOutput, selectFields } from "../../src/output.js";

describe("output formatting", () => {
  it("formats JSON without ANSI codes", () => {
    const out = formatOutput({ ok: true }, { format: "json" });
    expect(JSON.parse(out)).toEqual({ ok: true });
    expect(out).not.toMatch(/\u001b\[/);
  });

  it("formats arrays as NDJSON", () => {
    expect(formatOutput([{ id: 1 }, { id: 2 }], { format: "ndjson" })).toBe('{"id":1}\n{"id":2}');
  });

  it("selects requested top-level fields", () => {
    expect(selectFields({ id: 1, title: "x", extra: true }, ["id", "title"])).toEqual({ id: 1, title: "x" });
  });
});
