import { describe, expect, it } from "vitest";
import { postSteps, type StepInput } from "./steps";

const fresh: StepInput = { id: "p1", type: "explain", status: "interview", interviewQas: [], drafts: [], diagram: null };
const done = (p: StepInput) => Object.fromEntries(postSteps(p).map((s) => [s.key, s.done]));

describe("postSteps", () => {
  it("starts with nothing done and links every step", () => {
    expect(done(fresh)).toEqual({ interview: false, drafts: false, diagram: false, kit: false });
    expect(postSteps(fresh).map((s) => s.href)).toEqual([
      "/posts/p1/interview",
      "/posts/p1/drafts",
      "/posts/p1/diagram",
      "/posts/p1/kit",
    ]);
  });

  it("needs every interview answer", () => {
    expect(done({ ...fresh, interviewQas: [{ answer: "yes" }, { answer: " " }] }).interview).toBe(false);
    expect(done({ ...fresh, interviewQas: [{ answer: "yes" }, { answer: "no" }] }).interview).toBe(true);
  });

  it("marks drafts, diagram and kit from saved rows", () => {
    const now = new Date();
    const p = {
      ...fresh,
      drafts: [
        { isFinal: true, postedAt: now },
        { isFinal: true, postedAt: null },
        { isFinal: false, postedAt: null },
      ],
      diagram: { pngUrl: "https://blob/x.png" },
    };
    expect(done(p)).toMatchObject({ drafts: true, diagram: true, kit: false });
    expect(done({ ...p, drafts: [{ isFinal: true, postedAt: now }] }).kit).toBe(true);
    expect(done({ ...fresh, status: "posted" }).kit).toBe(true);
    expect(done({ ...fresh, diagram: { pngUrl: null } }).diagram).toBe(false);
  });

  it("drops the diagram step for lessons posts", () => {
    expect(postSteps({ ...fresh, type: "lessons" }).map((s) => s.key)).toEqual(["interview", "drafts", "kit"]);
  });
});
