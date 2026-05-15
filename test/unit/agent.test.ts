import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/app.js";

describe("adaptive agent commands", () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads an empty profile without creating a missing cache", async () => {
    const dir = tempCacheDir(dirs);

    const result = await runCli(["agent", "profile", "get", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      cachePath: join(dir, "zap.sqlite"),
      preferences: []
    });
    expect(existsSync(join(dir, "zap.sqlite"))).toBe(false);
  });

  it("sets, lists, and unsets local preferences without fetching", async () => {
    const dir = tempCacheDir(dirs);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const setResult = await runCli(["agent", "profile", "set", "--key", "preferred.output", "--value", "json", "--output", "json"], cliContext(dir));
    expect(setResult.exitCode).toBe(0);
    expect(JSON.parse(setResult.stdout)).toEqual({
      key: "preferred.output",
      value: "json",
      updatedAt: expect.any(String)
    });

    const getResult = await runCli(["agent", "profile", "get", "--output", "json"], cliContext(dir));
    expect(getResult.exitCode).toBe(0);
    expect(JSON.parse(getResult.stdout)).toEqual({
      cachePath: join(dir, "zap.sqlite"),
      preferences: [expect.objectContaining({ key: "preferred.output", value: "json" })]
    });

    const unsetResult = await runCli(["agent", "profile", "unset", "--key", "preferred.output", "--output", "json"], cliContext(dir));
    expect(unsetResult.exitCode).toBe(0);
    expect(JSON.parse(unsetResult.stdout)).toEqual({ key: "preferred.output", removed: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records explicit feedback and summarizes adaptive suggestions", async () => {
    const dir = tempCacheDir(dirs);

    await runCli(["agent", "profile", "set", "--key", "budget.maxIls", "--value", "4500", "--output", "json"], cliContext(dir));
    const feedbackResult = await runCli(
      [
        "agent",
        "feedback",
        "add",
        "--command",
        "product offers",
        "--rating",
        "5",
        "--output-format",
        "json",
        "--notes",
        "ranked output was useful",
        "--output",
        "json"
      ],
      cliContext(dir)
    );

    expect(feedbackResult.exitCode).toBe(0);
    expect(JSON.parse(feedbackResult.stdout)).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        command: "product offers",
        rating: 5,
        outputFormat: "json",
        notes: "ranked output was useful",
        createdAt: expect.any(String)
      })
    );

    const suggestResult = await runCli(["agent", "suggest", "--output", "json"], cliContext(dir));
    expect(suggestResult.exitCode).toBe(0);
    expect(JSON.parse(suggestResult.stdout)).toEqual(
      expect.objectContaining({
        cachePath: join(dir, "zap.sqlite"),
        feedbackSummary: {
          count: 1,
          averageRating: 5,
          preferredOutputFormat: "json",
          topCommands: [{ command: "product offers", count: 1 }]
        },
        recommendations: expect.arrayContaining([
          "Default examples and agent handoffs should prefer --output json.",
          "Use 4500 ILS as the user's default maximum budget unless a task overrides it.",
          "Surface product offers as a likely next command when relevant.",
          "Do not update shared skills or code automatically; propose reviewable diffs or PRs."
        ]),
        skillDraft: expect.arrayContaining(["## User Preference Notes", "- budget.maxIls: 4500"])
      })
    );
  });

  it("drafts skill notes without writing skill files", async () => {
    const dir = tempCacheDir(dirs);
    await runCli(["agent", "profile", "set", "--key", "preferred.category", "--value", "electric", "--output", "json"], cliContext(dir));

    const result = await runCli(["agent", "skill", "draft", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      cachePath: join(dir, "zap.sqlite"),
      format: "markdown",
      lines: expect.arrayContaining([
        "## User Preference Notes",
        "- preferred.category: electric",
        "- Do not update shared skills or code automatically; propose reviewable diffs or PRs."
      ])
    });
  });

  it("rejects invalid preference keys and feedback ratings", async () => {
    const dir = tempCacheDir(dirs);

    const keyResult = await runCli(["agent", "profile", "set", "--key", "../secret", "--value", "json", "--output", "json"], cliContext(dir));
    expect(keyResult.exitCode).toBe(2);
    expect(JSON.parse(keyResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "Invalid preference key \"../secret\".",
        hint: "Use a key like preferred.output or budget.maxIls."
      }
    });

    const outputResult = await runCli(
      ["agent", "profile", "set", "--key", "preferred.output", "--value", "xml", "--output", "json"],
      cliContext(dir)
    );
    expect(outputResult.exitCode).toBe(2);
    expect(JSON.parse(outputResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: 'Unsupported feedback output format "xml".',
        hint: "Use json, text, ndjson, or csv."
      }
    });

    const budgetResult = await runCli(
      ["agent", "profile", "set", "--key", "budget.maxIls", "--value", "free", "--output", "json"],
      cliContext(dir)
    );
    expect(budgetResult.exitCode).toBe(2);
    expect(JSON.parse(budgetResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "budget.maxIls must be a positive number."
      }
    });

    const ratingResult = await runCli(
      ["agent", "feedback", "add", "--command", "search local", "--rating", "7", "--output", "json"],
      cliContext(dir)
    );
    expect(ratingResult.exitCode).toBe(2);
    expect(JSON.parse(ratingResult.stderr)).toEqual({
      error: {
        code: "INVALID_ARGUMENTS",
        message: "--rating must be an integer from 1 to 5."
      }
    });
  });

  it("surfaces unreadable adaptive state warnings", async () => {
    const dir = tempCacheDir(dirs);
    writeFileSync(join(dir, "zap.sqlite"), "not sqlite", "utf8");

    const result = await runCli(["agent", "suggest", "--output", "json"], cliContext(dir));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        cachePath: join(dir, "zap.sqlite"),
        preferences: [],
        feedbackSummary: {
          count: 0,
          averageRating: null,
          preferredOutputFormat: null,
          topCommands: []
        },
        warnings: ["Local adaptive-agent state could not be read."]
      })
    );
  });

  it("lists schemas for adaptive agent commands", async () => {
    const result = await runCli(["schema", "list", "--output", "json"], { stdoutIsTTY: false });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.objectContaining({
        commands: expect.arrayContaining([
          expect.objectContaining({ key: "agent-profile-get", name: "agent profile get" }),
          expect.objectContaining({ key: "agent-feedback-add", name: "agent feedback add" }),
          expect.objectContaining({ key: "agent-skill-draft", name: "agent skill draft" })
        ])
      })
    );
  });
});

function tempCacheDir(dirs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "zap-agent-"));
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
