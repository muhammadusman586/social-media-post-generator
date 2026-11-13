import { describe, expect, it } from "vitest";
import { buildDraftPrompt, type DraftContext } from "./prompt";

const base: DraftContext = {
  post: { type: "tried", title: "Trying AI SDK 7" },
  profile: { handle: "@usman", bio: "AI engineer", stack: ["Next.js"], topics: ["evals"], neverMention: ["Initech"] },
  voice: ["I write short sentences. Mostly lowercase."],
  item: { title: "AI SDK 7 released", url: "https://example.com/ai7", summary: "New Output API.", whyItMatters: "You use it daily." },
  reflection: null,
  qas: [
    { question: "What did you build?", answer: "migrated brand studio drafts, 3 ghantay lag gaye" },
    { question: "What broke?", answer: null },
    { question: "What surprised you?", answer: "   " },
  ],
  uploads: [
    { kind: "code", blobUrl: null, codeText: "const mine = 1;", isGenerated: false, approvedAt: null },
    { kind: "code", blobUrl: null, codeText: "const pending = 2;", isGenerated: true, approvedAt: null },
    { kind: "code", blobUrl: null, codeText: "const approved = 3;", isGenerated: true, approvedAt: new Date() },
    { kind: "image", blobUrl: "https://blob/shot.png", codeText: null, isGenerated: false, approvedAt: null },
  ],
  hasDiagram: false,
};

describe("buildDraftPrompt", () => {
  const { instructions, prompt } = buildDraftPrompt(base, "linkedin");

  it("includes the radar item and answered questions", () => {
    expect(prompt).toContain("AI SDK 7 released");
    expect(prompt).toContain("https://example.com/ai7");
    expect(prompt).toContain("Q: What did you build?\nA: migrated brand studio drafts, 3 ghantay lag gaye");
  });

  it("leaves out unanswered and blank questions", () => {
    expect(prompt).not.toContain("What broke?");
    expect(prompt).not.toContain("What surprised you?");
  });

  it("includes own code and approved examples, never unapproved ones", () => {
    expect(prompt).toContain("const mine = 1;");
    expect(prompt).toContain("AI-written illustrative example (approved):\n```\nconst approved = 3;");
    expect(prompt).not.toContain("const pending = 2;");
  });

  it("mentions a screenshot without its URL", () => {
    expect(prompt).toContain("attached a screenshot");
    expect(prompt).not.toContain("https://blob/shot.png");
  });

  it("marks profile and voice as non-facts and forbids never-mention names", () => {
    expect(prompt).toContain("## PROFILE (background only)");
    expect(prompt).toContain("## VOICE (style only)");
    expect(instructions).toContain("Never mention these names: Initech.");
    expect(instructions).toContain("[ADD:");
    expect(instructions).toContain("Never invent");
  });

  it("applies the platform rules", () => {
    expect(instructions).toContain("150-250 words");
    expect(buildDraftPrompt(base, "x").instructions).toContain("274 characters");
    expect(buildDraftPrompt({ ...base, post: { ...base.post, type: "explain" } }, "instagram").instructions).toContain("6-7 slides");
    expect(buildDraftPrompt({ ...base, post: { ...base.post, type: "lessons" } }, "instagram").instructions).toContain(
      "exactly 1 slide of kind quote",
    );
  });

  it("uses the reflection as the source for lessons and says when there are no answers", () => {
    const lessons = buildDraftPrompt(
      { ...base, item: null, qas: [], uploads: [], reflection: { question: "What did you get wrong?", answer: "estimates" } },
      "x",
    );
    expect(lessons.prompt).toContain("Question: What did you get wrong?\nOwner's answer: estimates");
    expect(lessons.prompt).toContain("(no answers yet)");
    expect(lessons.prompt).toContain("## PROOF\n(none)");
  });

  it("adds the previous draft and the owner's instruction on regenerate", () => {
    const { prompt: p } = buildDraftPrompt(base, "linkedin", { previous: "old text", instruction: " more blunt " });
    expect(p).toContain("## PREVIOUS DRAFT\nold text");
    expect(p).toContain("## OWNER'S INSTRUCTION FOR THIS VERSION\nmore blunt");
  });
});
