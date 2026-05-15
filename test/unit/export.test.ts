import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/app.js";
import { ZapStore } from "../../src/store.js";

describe("export commands", () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports a bounded official RSS category as a JSON envelope", async () => {
    const fetchMock = vi.fn(async () => new Response(rssXml([rssItem("1264897", "Wiim Mini"), rssItem("2264897", "Wiim Ultra")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--limit", "1", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(Date.parse(output.exportedAt)).not.toBeNaN();
    expect(output).toEqual({
      schemaVersion: "zap.rss-item.v1",
      recordType: "rss_item",
      category: "electric",
      exportedAt: expect.any(String),
      sourceUrl: "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
      provenance: {
        kind: "cli_verified",
        source: "official_rss",
        sourceUrl: "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
        fetchedAt: expect.any(String)
      },
      items: [
        expect.objectContaining({
          id: "1264897",
          title: "Wiim Mini",
          category: "electric",
          modelId: "1264897",
          productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897"
        })
      ]
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://www.zap.co.il/xmls/general/rss.aspx");
    expect(url.searchParams.get("cat")).toBe("electric");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
  });

  it("exports RSS items as one parseable NDJSON row per item with provenance fields", async () => {
    const fetchMock = vi.fn(async () => new Response(rssXml([rssItem("1264897", "Wiim Mini"), rssItem("2264897", "Wiim Ultra")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--limit", "2", "--output", "ndjson"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    const rows = result.stdout.split("\n").map((line) => JSON.parse(line));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      schemaVersion: "zap.rss-item.v1",
      recordType: "rss_item",
      category: "electric",
      exportedAt: expect.any(String),
      provenance: {
        kind: "cli_verified",
        source: "official_rss",
        sourceUrl: "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
        fetchedAt: expect.any(String)
      },
      id: "1264897",
      title: "Wiim Mini",
      descriptionText: "official feed item",
      publishedAt: "2026-05-14T12:02:00.000Z",
      modelId: "1264897",
      productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897",
      imageUrl: null
    });
    expect(Date.parse(rows[1].exportedAt)).not.toBeNaN();
    expect(rows[1]).toEqual(expect.objectContaining({ id: "2264897", recordType: "rss_item" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exports RSS items as parseable CSV with escaped and formula-safe scalar fields", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(rssXml([rssItem("1264897", ' =Wiim, "Mini"', "\t@fast, \"small\" streamer", "https://img.zap.co.il/pic.jpg")]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--limit", "1", "--output", "csv"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"\'=Wiim, ""Mini"""');
    const parsed = parseCsv(result.stdout);
    expect(parsed.headers).toEqual([
      "schemaVersion",
      "recordType",
      "category",
      "exportedAt",
      "provenance.kind",
      "provenance.source",
      "provenance.sourceUrl",
      "provenance.fetchedAt",
      "id",
      "title",
      "descriptionText",
      "publishedAt",
      "modelId",
      "productUrl",
      "imageUrl"
    ]);
    expect(parsed.rows).toEqual([
      {
        schemaVersion: "zap.rss-item.v1",
        recordType: "rss_item",
        category: "electric",
        exportedAt: expect.any(String),
        "provenance.kind": "cli_verified",
        "provenance.source": "official_rss",
        "provenance.sourceUrl": "https://www.zap.co.il/xmls/general/rss.aspx?cat=electric",
        "provenance.fetchedAt": expect.any(String),
        id: "1264897",
        title: '\'=Wiim, "Mini"',
        descriptionText: '\'@fast, "small" streamer',
        publishedAt: "2026-05-14T12:02:00.000Z",
        modelId: "1264897",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897",
        imageUrl: "https://img.zap.co.il/pic.jpg"
      }
    ]);
    expect(Date.parse(parsed.rows[0]?.exportedAt ?? "")).not.toBeNaN();
    expect(Date.parse(parsed.rows[0]?.["provenance.fetchedAt"] ?? "")).not.toBeNaN();
  });

  it("exports the local watchlist as JSON without fetching and excludes notes by default", async () => {
    const dir = tempCacheDir(dirs);
    seedWatchItem(dir, { title: "iPhone 17", notes: "check before buying" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["watch", "export", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(Date.parse(output.exportedAt)).not.toBeNaN();
    expect(output).toEqual({
      schemaVersion: "zap.watch-item.v1",
      recordType: "watch_item",
      exportedAt: expect.any(String),
      provenance: {
        kind: "cli_verified",
        source: "watchlist",
        fetchedAt: expect.any(String)
      },
      notesIncluded: false,
      items: [
        expect.objectContaining({
          modelId: "1253558",
          title: "iPhone 17",
          targetPriceIls: 349.5,
          notes: null,
          productUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
          specUrl: "https://www.zap.co.il/compmodels.aspx?modelid=1253558"
        })
      ]
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exports an empty watchlist without creating a missing local cache", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["watch", "export", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: "zap.watch-item.v1",
      recordType: "watch_item",
      exportedAt: expect.any(String),
      provenance: {
        kind: "cli_verified",
        source: "watchlist",
        fetchedAt: expect.any(String)
      },
      notesIncluded: false,
      items: []
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "zap.sqlite"))).toBe(false);
  });

  it("exports the local watchlist as parseable CSV with notes excluded by default", async () => {
    const dir = tempCacheDir(dirs);
    seedWatchItem(dir, { title: ' =Wiim, "Mini"', notes: 'line 1\nline "2"' });

    const result = await runCli(["watch", "export", "--output", "csv"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"\' =Wiim, ""Mini"""');
    expect(result.stdout).not.toContain("line 1");
    const parsed = parseCsv(result.stdout);
    expect(parsed.headers).toEqual([
      "schemaVersion",
      "recordType",
      "exportedAt",
      "notesIncluded",
      "provenance.kind",
      "provenance.source",
      "provenance.fetchedAt",
      "id",
      "modelId",
      "title",
      "targetPriceIls",
      "productUrl",
      "specUrl",
      "notes",
      "createdAt"
    ]);
    expect(parsed.rows).toEqual([
      expect.objectContaining({
        schemaVersion: "zap.watch-item.v1",
        recordType: "watch_item",
        notesIncluded: "false",
        "provenance.kind": "cli_verified",
        "provenance.source": "watchlist",
        modelId: "1253558",
        title: '\' =Wiim, "Mini"',
        targetPriceIls: "349.5",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=1253558",
        specUrl: "https://www.zap.co.il/compmodels.aspx?modelid=1253558",
        notes: ""
      })
    ]);
    expect(Date.parse(parsed.rows[0]?.exportedAt ?? "")).not.toBeNaN();
    expect(Date.parse(parsed.rows[0]?.["provenance.fetchedAt"] ?? "")).not.toBeNaN();
  });

  it("exports watch notes only when explicitly requested", async () => {
    const dir = tempCacheDir(dirs);
    seedWatchItem(dir, { title: 'Wiim, "Mini"', notes: 'line 1\nline "2"' });

    const result = await runCli(["watch", "export", "--include-notes", "--output", "csv"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"line 1\nline ""2"""');
    const parsed = parseCsv(result.stdout);
    expect(parsed.rows).toEqual([
      expect.objectContaining({
        notesIncluded: "true",
        notes: 'line 1\nline "2"'
      })
    ]);
  });

  it("writes feed export output to a file and returns a status envelope", async () => {
    const dir = tempCacheDir(dirs);
    const outPath = join(dir, "exports", "feed.csv");
    const fetchMock = vi.fn(async () => new Response(rssXml([rssItem("1264897", "Wiim Mini")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--limit", "1", "--output", "csv", "--out", outPath], {
      stdoutIsTTY: true
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      outputPath: outPath,
      format: "csv",
      recordType: "rss_item",
      itemCount: 1,
      bytes: expect.any(Number)
    });
    expect(readFileSync(outPath, "utf8")).toContain("zap.rss-item.v1,rss_item,electric");
  });

  it("writes export files quietly when --quiet is used", async () => {
    const dir = tempCacheDir(dirs);
    const outPath = join(dir, "exports", "feed.json");
    const fetchMock = vi.fn(async () => new Response(rssXml([rssItem("1264897", "Wiim Mini")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--limit", "1", "--output", "json", "--out", outPath, "--quiet"], {
      stdoutIsTTY: true
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(readFileSync(outPath, "utf8"))).toEqual(expect.objectContaining({ recordType: "rss_item" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes watch export JSON without notes by default", async () => {
    const dir = tempCacheDir(dirs);
    seedWatchItem(dir, { title: "iPhone 17", notes: "private note" });
    const outPath = join(dir, "exports", "watch.json");

    const result = await runCli(["watch", "export", "--output", "json", "--out", outPath], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({ outputPath: outPath, format: "json", recordType: "watch_item", itemCount: 1 }));
    const written = JSON.parse(readFileSync(outPath, "utf8"));
    expect(written.notesIncluded).toBe(false);
    expect(written.items[0].notes).toBeNull();
  });

  it("rejects --out for non-export commands before running them", async () => {
    const dir = tempCacheDir(dirs);
    const outPath = join(dir, "about.json");

    const result = await runCli(["about", "--out", outPath, "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "--out is only supported for export commands.",
        hint: "Use feed export or watch export."
      }
    });
    expect(existsSync(outPath)).toBe(false);
  });

  it("rejects an empty --out value before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--output", "json", "--out="], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "--out requires a non-empty path.",
        hint: "Use --out <path>."
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty --out on non-export commands before running them", async () => {
    const result = await runCli(["about", "--out=", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "--out is only supported for export commands.",
        hint: "Use feed export or watch export."
      }
    });
  });

  it("does not overwrite an existing export file", async () => {
    const dir = tempCacheDir(dirs);
    const outPath = join(dir, "feed.csv");
    writeFileSync(outPath, "existing\n", "utf8");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCli(["feed", "export", "--category", "electric", "--output", "csv", "--out", outPath], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: `Output path already exists: ${outPath}.`,
        hint: "Choose a new path; overwriting is not supported."
      }
    });
    expect(readFileSync(outPath, "utf8")).toBe("existing\n");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects --out paths that target the active cache database", async () => {
    const dir = tempCacheDir(dirs);
    const cacheFile = join(dir, "zap.sqlite");

    const result = await runCli(["watch", "export", "--output", "json", "--out", cacheFile], cliContext(dir));

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "--out must not target the active cache database.",
        hint: "Choose a separate export file path."
      }
    });
    expect(existsSync(cacheFile)).toBe(false);
  });

  it("filters export item fields with --select so notes are not leaked", async () => {
    const dir = tempCacheDir(dirs);
    seedWatchItem(dir, { title: "iPhone 17", notes: "private note" });

    const result = await runCli(["watch", "export", "--include-notes", "--select", "id,title", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.notesIncluded).toBe(true);
    expect(output.items).toEqual([expect.objectContaining({ id: expect.any(String), title: "iPhone 17" })]);
    expect(output.items[0]).not.toHaveProperty("notes");
  });

  it("rejects positional values after boolean include-notes", async () => {
    const result = await runCli(["watch", "export", "--include-notes", "false", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unexpected argument "false" for watch export.'
      }
    });
  });

  it("returns stable errors for unsupported export output formats", async () => {
    const feedResult = await runCli(["feed", "export", "--category", "electric", "--output", "text"], { stdoutIsTTY: false });
    expect(feedResult.exitCode).toBe(2);
    expect(JSON.parse(feedResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported output format "text" for feed export.',
        hint: "Use json, ndjson, or csv."
      }
    });

    const watchResult = await runCli(["watch", "export", "--output", "ndjson"], { stdoutIsTTY: false });
    expect(watchResult.exitCode).toBe(2);
    expect(JSON.parse(watchResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported output format "ndjson" for watch export.',
        hint: "Use json or csv."
      }
    });
  });

  it("lists schemas for export commands", async () => {
    const listResult = await runCli(["schema", "list", "--output", "json"], { stdoutIsTTY: false });
    expect(listResult.exitCode).toBe(0);
    expect(JSON.parse(listResult.stdout)).toEqual(
      expect.objectContaining({
        commands: expect.arrayContaining([
          expect.objectContaining({ key: "feed-export", name: "feed export" }),
          expect.objectContaining({ key: "watch-export", name: "watch export" })
        ])
      })
    );

    const getResult = await runCli(["schema", "get", "watch-export", "--output", "json"], { stdoutIsTTY: false });
    expect(getResult.exitCode).toBe(0);
    expect(JSON.parse(getResult.stdout)).toEqual(
      expect.objectContaining({
        key: "watch-export",
        output: expect.stringContaining("notesIncluded")
      })
    );
  });
});

function tempCacheDir(dirs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zap-export-"));
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

function seedWatchItem(cacheDir: string, overrides: { title: string; notes: string }): void {
  const store = new ZapStore(join(cacheDir, "zap.sqlite"));
  try {
    store.addWatchItem({
      modelId: "1253558",
      title: overrides.title,
      targetPriceIls: 349.5,
      notes: overrides.notes
    });
  } finally {
    store.close();
  }
}

interface RssXmlItem {
  modelId: string;
  title: string;
  description: string;
  imageUrl: string | null;
}

function rssItem(modelId: string, title: string, description = "official feed item", imageUrl: string | null = null): RssXmlItem {
  return { modelId, title, description, imageUrl };
}

function rssXml(items: RssXmlItem[]): string {
  return `<?xml version="1.0" encoding="windows-1255"?>
    <rss version="2.0"><channel>
      ${items
        .map(
          (item) => `<item>
            <title><![CDATA[${item.title}]]></title>
            <description><![CDATA[${item.description}]]></description>
            <pubDate>Thu, 14 May 2026 12:02:00 GMT</pubDate>
            <link>https://www.zap.co.il/model.aspx?modelid=${item.modelId}</link>
            ${item.imageUrl ? `<image><url>${item.imageUrl}</url></image>` : ""}
          </item>`
        )
        .join("")}
    </channel></rss>`;
}

function parseCsv(input: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const headers = records[0] ?? [];
  const rows = records.slice(1).map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
  return { headers, rows };
}
