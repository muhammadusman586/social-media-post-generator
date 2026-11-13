import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDraft } from "./generate";
import type { DraftContext } from "./prompt";

const calls: string[] = [];
let reply = "{}";

vi.mock("@/lib/ai", () => ({
  getModel: () =>
    new MockLanguageModelV4({
      doGenerate: async ({ prompt }) => {
        calls.push(JSON.stringify(prompt));
        return {
          content: [{ type: "text", text: reply }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        };
      },
    }),
}));

const ctx: DraftContext = {
  post: { type: "explain", title: "MCP" },
  profile: null,
  voice: [],
  item: { title: "MCP explained", url: "https://example.com", summary: "s", whyItMatters: "w" },
  reflection: null,
  qas: [{ question: "How would you explain it?", answer: "USB for tools" }],
  uploads: [],
  hasDiagram: false,
};

beforeEach(() => {
  calls.length = 0;
});

describe("generateDraft (mocked LLM)", () => {
  it("sends the answers to the model and trims LinkedIn text", async () => {
    reply = JSON.stringify({ text: "  MCP is USB for tools. [ADD: where you used it]  " });
    const draft = await generateDraft(ctx, "linkedin");
    expect(draft).toEqual({ content: { text: "MCP is USB for tools. [ADD: where you used it]" } });
    expect(calls[0]).toContain("USB for tools");
  });

  it("strips numbering and empty posts from an X thread", async () => {
    reply = JSON.stringify({ posts: ["1/3 First", "Second 2/3", " ", "(3/3) Third"] });
    expect(await generateDraft(ctx, "x")).toEqual({ content: { posts: ["First", "Second", "Third"] } });
  });

  it("drops null slide fields and caps explain slides at 7", async () => {
    const slide = { kind: "text", heading: "H", body: null, code: null, language: null, quote: null };
    reply = JSON.stringify({ caption: "Cap", slides: Array(9).fill(slide) });
    const draft = await generateDraft(ctx, "instagram");
    expect(draft.content).toEqual({ caption: "Cap" });
    expect(draft.slides).toHaveLength(7);
    expect(draft.slides![0]).toEqual({ kind: "text", content: { heading: "H" } });
  });

  it("keeps one quote slide for lessons", async () => {
    reply = JSON.stringify({
      caption: "Cap",
      slides: [
        { kind: "title", heading: "T", body: null, code: null, language: null, quote: null },
        { kind: "quote", heading: null, body: null, code: null, language: null, quote: "Ship small." },
        { kind: "quote", heading: null, body: null, code: null, language: null, quote: "Second." },
      ],
    });
    const draft = await generateDraft({ ...ctx, post: { type: "lessons", title: "" } }, "instagram");
    expect(draft.slides).toEqual([{ kind: "quote", content: { quote: "Ship small." } }]);
  });
});
