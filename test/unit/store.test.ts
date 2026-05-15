import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ZapStore } from "../../src/store.js";

describe("ZapStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("syncs RSS items and searches them offline", () => {
    const dir = mkdtempSync(join(tmpdir(), "zap-store-"));
    dirs.push(dir);
    const store = new ZapStore(join(dir, "zap.sqlite"));

    store.upsertRssItems([
      {
        id: "1264897",
        title: "סטרימר Wiim Mini",
        descriptionText: "מותג: Wiim",
        category: "electric",
        publishedAt: "2026-05-14T12:02:00.000Z",
        modelId: "1264897",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897",
        imageUrl: "https://img.zap.co.il/pics/7/7/0/6/96856077c"
      }
    ]);

    expect(store.searchRssItems("Wiim", 5)).toHaveLength(1);
    store.close();
  });

  it("stores and removes watchlist items", () => {
    const dir = mkdtempSync(join(tmpdir(), "zap-store-"));
    dirs.push(dir);
    const store = new ZapStore(join(dir, "zap.sqlite"));

    const added = store.addWatchItem({
      modelId: "1253558",
      title: "iPhone 17",
      targetPriceIls: 2500,
      notes: "Check before v1"
    });

    expect(store.listWatchItems()).toEqual([expect.objectContaining({ id: added.id, modelId: "1253558" })]);
    expect(store.removeWatchItem(added.id)).toBe(true);
    expect(store.listWatchItems()).toEqual([]);
    store.close();
  });
});
