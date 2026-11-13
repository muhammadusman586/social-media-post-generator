import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { collectCandidates, linksFromListing, normalizeUrl, type Candidate, type Source } from "./candidates";
import type { FirecrawlLike } from "./firecrawl";
import { rankCandidates, toShortlist, type RankingOutput } from "./rank";
import { buildShortlist } from "./run";

const source = (over: Partial<Source>): Source => ({
  id: crypto.randomUUID(),
  name: "s",
  url: null,
  query: null,
  kind: "blog",
  enabled: true,
  createdAt: new Date(),
  ...over,
});

/** Fake Firecrawl: listing markdown by URL; search returns `web`. */
function fakeFirecrawl(pages: Record<string, string>, web: { url: string; title: string; description?: string }[] = []) {
  return {
    search: vi.fn(async () => ({ web })),
    scrape: vi.fn(async (url: string) => {
      if (!(url in pages)) throw new Error(`404 ${url}`);
      return { markdown: pages[url] };
    }),
  } as unknown as FirecrawlLike & { search: ReturnType<typeof vi.fn>; scrape: ReturnType<typeof vi.fn> };
}

/** Mock model that answers each call with the next JSON value. */
function mockModel(...outputs: unknown[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(outputs[Math.min(call++, outputs.length - 1)]) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

const pick = (index: number, score = 0.5) => ({
  index,
  title: `Pick ${index}`,
  summary: "What it is.",
  whyItMatters: "You use this.",
  suggestedType: "tried" as const,
  score,
});

const candidates = (n: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({ url: `https://x.dev/${i}`, title: `C${i}`, snippet: "", sourceId: "src" }));

describe("normalizeUrl", () => {
  it("drops hash, utm params and trailing slash", () => {
    expect(normalizeUrl("https://a.dev/post/?utm_source=hn&id=2#top")).toBe("https://a.dev/post?id=2");
    expect(normalizeUrl("/blog/x", "https://a.dev/blog")).toBe("https://a.dev/blog/x");
    expect(normalizeUrl("mailto:me@a.dev")).toBeNull();
  });
});

describe("source-kind dispatch", () => {
  it("search sources use Firecrawl search limited to the last week", async () => {
    const fc = fakeFirecrawl({}, [{ url: "https://news.dev/a", title: "A", description: "snippet" }]);
    const out = await collectCandidates([source({ kind: "search", query: "ai news" })], fc, new Set());
    expect(fc.search).toHaveBeenCalledWith("ai news", expect.objectContaining({ tbs: "qdr:w" }));
    expect(fc.scrape).not.toHaveBeenCalled();
    expect(out).toMatchObject([{ url: "https://news.dev/a", title: "A", snippet: "snippet" }]);
  });

  it("hn keeps off-site story links only", () => {
    const md = `1. [Show HN: A tiny DB](https://tiny.dev/) (tiny.dev)\n120 points by [bob](https://news.ycombinator.com/user?id=bob) | [45 comments](https://news.ycombinator.com/item?id=1)`;
    const out = linksFromListing(md, source({ kind: "hn", url: "https://news.ycombinator.com/" }));
    expect(out.map((c) => c.url)).toEqual(["https://tiny.dev"]);
  });

  it("github_trending keeps owner/repo links only", () => {
    const md = `## [vercel / ai](https://github.com/vercel/ai)\nThe AI toolkit\n[stars](https://github.com/vercel/ai/stargazers) [Sponsor](https://github.com/sponsors/x) [me](https://github.com/me)`;
    const out = linksFromListing(md, source({ kind: "github_trending", url: "https://github.com/trending" }));
    expect(out).toMatchObject([{ url: "https://github.com/vercel/ai", title: "vercel / ai" }]);
    expect(out[0].snippet).toContain("The AI toolkit");
  });

  it("blog keeps posts under the listing path, falling back to deep same-site links", () => {
    const blog = source({ kind: "blog", url: "https://nextjs.org/blog" });
    const md = `[Docs](/docs) [Next.js 17](/blog/next-17) [Elsewhere](https://other.dev/blog/x)`;
    expect(linksFromListing(md, blog).map((c) => c.url)).toEqual(["https://nextjs.org/blog/next-17"]);

    const news = source({ kind: "blog", url: "https://openai.com/news/" });
    expect(linksFromListing(`[Research](/research) [New model](/index/new-model)`, news).map((c) => c.url)).toEqual([
      "https://openai.com/index/new-model",
    ]);
  });

  it("skips disabled sources and survives a failing one", async () => {
    const fc = fakeFirecrawl({ "https://ok.dev/blog": "[Post one](/blog/one)" });
    const out = await collectCandidates(
      [
        source({ url: "https://dead.dev/blog" }),
        source({ url: "https://ok.dev/blog" }),
        source({ url: "https://off.dev/blog", enabled: false }),
      ],
      fc,
      new Set(),
    );
    expect(out.map((c) => c.url)).toEqual(["https://ok.dev/blog/one"]);
    expect(fc.scrape).toHaveBeenCalledTimes(2);
  });
});

describe("candidate dedupe", () => {
  it("dedupes across sources and skips URLs already in radar_items", async () => {
    const fc = fakeFirecrawl({
      "https://a.dev/blog": "[Same post](/blog/same/) [Old post](/blog/old)",
      "https://a.dev/changelog": "[Same post again](https://a.dev/blog/same#x)",
    });
    const out = await collectCandidates(
      [source({ url: "https://a.dev/blog" }), source({ kind: "changelog", url: "https://a.dev/changelog" })],
      fc,
      new Set(["https://a.dev/blog/old"]),
    );
    expect(out.map((c) => c.url)).toEqual(["https://a.dev/blog/same"]);
  });
});

describe("ranking", () => {
  it("drops invalid and repeated indexes, clamps score, takes url from the candidate", () => {
    const output: RankingOutput = { picks: [pick(1, 3), pick(1, 0.9), pick(9), pick(-1), pick(0, -2)] };
    const list = toShortlist(output, candidates(2));
    expect(list.map((i) => [i.url, i.score])).toEqual([
      ["https://x.dev/1", 1],
      ["https://x.dev/0", 0],
    ]);
  });

  it("keeps at most 5 picks, highest score first", () => {
    const output = { picks: [0, 1, 2, 3, 4, 5, 6].map((i) => pick(i, i / 10)) };
    const list = toShortlist(output, candidates(7));
    expect(list).toHaveLength(5);
    expect(list[0].url).toBe("https://x.dev/6");
  });

  it("parses the model's structured output", async () => {
    const list = await rankCandidates(candidates(3), undefined, mockModel({ picks: [pick(2, 0.8)] }));
    expect(list).toMatchObject([{ url: "https://x.dev/2", suggestedType: "tried", whyItMatters: "You use this." }]);
  });

  it("rejects output that does not match the schema", async () => {
    const bad = mockModel({ picks: [{ ...pick(0), suggestedType: "lessons" }] });
    await expect(rankCandidates(candidates(1), undefined, bad)).rejects.toThrow();
  });
});

describe("buildShortlist", () => {
  it("scrapes full pages only for the shortlist and uses them for summaries", async () => {
    const links = Array.from({ length: 8 }, (_, i) => `[Post number ${i}](/blog/p${i})`).join("\n");
    const pages: Record<string, string> = { "https://a.dev/blog": links };
    for (let i = 0; i < 8; i++) pages[`https://a.dev/blog/p${i}`] = `Full text ${i}`;
    const fc = fakeFirecrawl(pages);
    const model = mockModel(
      { picks: [0, 1, 2, 3, 4, 5].map((i) => pick(i, 1 - i / 10)) },
      { summaries: [{ index: 0, summary: "From the page." }] },
    );

    const list = await buildShortlist({
      sources: [source({ url: "https://a.dev/blog" })],
      profile: undefined,
      knownUrls: new Set(),
      firecrawl: fc,
      model,
    });

    expect(list).toHaveLength(5);
    expect(fc.scrape).toHaveBeenCalledTimes(1 + 5); // listing + shortlist only
    expect(list[0].summary).toBe("From the page.");
    expect(list[1].summary).toBe("What it is.");
  });

  it("skips the LLM when there are no new candidates", async () => {
    const model = mockModel({ picks: [] });
    const list = await buildShortlist({
      sources: [],
      profile: undefined,
      knownUrls: new Set(),
      firecrawl: fakeFirecrawl({}),
      model,
    });
    expect(list).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
