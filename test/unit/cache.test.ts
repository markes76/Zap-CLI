import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/app.js";
import { ZapStore } from "../../src/store.js";

describe("cache commands", () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports missing cache info without creating a database", async () => {
    const dir = tempCacheDir(dirs);

    const result = await runCli(["cache", "info", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      cachePath: join(dir, "zap.sqlite"),
      exists: false,
      readable: false,
      rssItemCount: 0,
      watchItemCount: 0,
      categories: []
    });
    expect(existsSync(join(dir, "zap.sqlite"))).toBe(false);
  });

  it("reports local RSS and watchlist cache counts without fetching", async () => {
    const dir = tempCacheDir(dirs);
    seedCache(dir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["cache", "info", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      cachePath: join(dir, "zap.sqlite"),
      exists: true,
      readable: true,
      rssItemCount: 2,
      watchItemCount: 1,
      categories: [
        {
          category: "comp",
          count: 1,
          newestPublishedAt: "2026-05-16T12:02:00.000Z"
        },
        {
          category: "electric",
          count: 1,
          newestPublishedAt: "2026-05-14T12:02:00.000Z"
        }
      ]
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports unreadable cache info without mutating corrupt local files", async () => {
    const dir = tempCacheDir(dirs);
    const cacheFile = join(dir, "zap.sqlite");
    writeFileSync(cacheFile, "not sqlite", "utf8");

    const result = await runCli(["cache", "info", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      cachePath: cacheFile,
      exists: true,
      readable: false,
      rssItemCount: 0,
      watchItemCount: 0,
      categories: []
    });
    expect(existsSync(cacheFile)).toBe(true);
  });

  it("lists the cache info schema", async () => {
    const result = await runCli(["schema", "get", "cache-info", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({ key: "cache-info", name: "cache info" }));
  });
});

function tempCacheDir(dirs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zap-cache-"));
  dirs.push(dir);
  return dir;
}

function cliContext(cacheDir: string) {
  return {
    stdoutIsTTY: false,
    env: {
      ...process.env,
      ZAP_CACHE_DIR: cacheDir
    }
  };
}

function seedCache(cacheDir: string): void {
  const store = new ZapStore(join(cacheDir, "zap.sqlite"));
  try {
    store.upsertRssItems([
      {
        id: "1264897",
        title: "Wiim Mini",
        descriptionText: "Streamer",
        category: "electric",
        publishedAt: "2026-05-14T12:02:00.000Z",
        modelId: "1264897",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897",
        imageUrl: null
      },
      {
        id: "2264897",
        title: "Laptop",
        descriptionText: "Computer",
        category: "comp",
        publishedAt: "2026-05-16T12:02:00.000Z",
        modelId: "2264897",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=2264897",
        imageUrl: null
      }
    ]);
    store.addWatchItem({ modelId: "1253558", title: "iPhone 17" });
  } finally {
    store.close();
  }
}
