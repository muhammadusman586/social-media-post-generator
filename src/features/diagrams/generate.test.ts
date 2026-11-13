import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { buildPrompt, proposeDiagramSpec, type DiagramSource } from "./generate";

const src: DiagramSource = {
  postType: "explain",
  title: "MCP in one picture",
  item: { title: "MCP spec update", url: "https://example.com/mcp", summary: "Servers expose tools.", whyItMatters: "I use it." },
  reflection: null,
  answers: [
    { question: "How would you explain it?", answer: "Client asks server for tools, model picks one." },
    { question: "Unanswered?", answer: null },
  ],
};

function mockModel(output: unknown) {
  let prompt = "";
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      prompt = JSON.stringify(opts.prompt);
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompt: () => prompt };
}

const diagram = {
  title: null,
  nodes: [
    { id: "c", label: "Client", group: null },
    { id: "s", label: "MCP server", group: null },
  ],
  edges: [
    { from: "c", to: "s", label: "list tools" },
    { from: "c", to: "nope", label: null },
  ],
  groups: [],
};

describe("proposeDiagramSpec", () => {
  it("returns a normalised spec when the model says it helps", async () => {
    const { model, prompt } = mockModel({ useful: true, reason: "It's a flow.", diagram });
    const res = await proposeDiagramSpec(src, { force: false, model });
    expect(res.useful).toBe(true);
    expect(res.spec?.edges).toEqual([{ from: "c", to: "s", label: "list tools" }]);
    expect(prompt()).toContain("Client asks server for tools");
    expect(prompt()).not.toContain("Unanswered?");
  });

  it("returns no spec when the model says no", async () => {
    const { model } = mockModel({ useful: false, reason: "It's an opinion piece.", diagram: null });
    expect(await proposeDiagramSpec(src, { force: false, model })).toEqual({
      useful: false,
      reason: "It's an opinion piece.",
      spec: null,
    });
  });

  it("uses the diagram when forced even if the model hedges", async () => {
    const { model } = mockModel({ useful: false, reason: "Borderline.", diagram });
    const res = await proposeDiagramSpec(src, { force: true, model });
    expect(res.spec?.nodes).toHaveLength(2);
  });
});

describe("buildPrompt", () => {
  it("asks for a diagram regardless when forced", () => {
    expect(buildPrompt(src, true)).toContain("wants a diagram anyway");
    expect(buildPrompt(src, false)).toContain("set useful to false");
  });
});
