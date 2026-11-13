import { describe, expect, it } from "vitest";
import type { FirecrawlLike } from "@/features/radar/lib/firecrawl";
import { bestUrl, composeSummary, findSources } from "./research";

const long = "x".repeat(400);
const pages = [
  { url: "https://a.dev", title: "A", markdown: long },
  { url: "https://b.dev", title: "B", markdown: long },
];

describe("findSources", () => {
  it("keeps pages with real text, reads url from metadata, caps at 3", async () => {
    const firecrawl = {
      search: async () => ({
        web: [
          { url: "https://1.dev", title: "One", markdown: long },
          { metadata: { sourceURL: "https://2.dev", title: "Two" }, markdown: long },
          { url: "https://thin.dev", title: "Thin", markdown: "short" },
          { url: "https://3.dev", title: "Three", markdown: long },
          { url: "https://4.dev", title: "Four", markdown: long },
        ],
      }),
      scrape: async () => ({}),
    } as unknown as FirecrawlLike;
    const found = await findSources("mcp", firecrawl);
    expect(found.map((p) => p.url)).toEqual(["https://1.dev", "https://2.dev", "https://3.dev"]);
    expect(found[1].title).toBe("Two");
  });
});

describe("composeSummary", () => {
  it("adds code and sources", () => {
    const s = composeSummary({ summary: "What it is.", code: "const a = 1;", language: "ts" }, pages);
    expect(s).toContain("```ts\nconst a = 1;\n```");
    expect(s).toContain("- B: https://b.dev");
  });
  it("skips code when there is none", () => {
    expect(composeSummary({ summary: "S", code: null, language: null }, pages)).not.toContain("```");
  });
});

describe("bestUrl", () => {
  it("falls back to the first page for a bad index", () => {
    expect(bestUrl({ bestSource: 1 }, pages)).toBe("https://b.dev");
    expect(bestUrl({ bestSource: 9 }, pages)).toBe("https://a.dev");
  });
});
