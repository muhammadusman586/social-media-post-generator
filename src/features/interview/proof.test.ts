import { describe, expect, it } from "vitest";
import { draftBlocker, finalizeBlockers, proofMissing, type ProofUpload } from "./proof";

const image: ProofUpload = { kind: "image", blobUrl: "https://blob/x.png", codeText: null, isGenerated: false, approvedAt: null };
const code: ProofUpload = { kind: "code", blobUrl: null, codeText: "const a = 1;", isGenerated: false, approvedAt: null };
const emptyCode: ProofUpload = { ...code, codeText: "   " };
const example: ProofUpload = { ...code, isGenerated: true };
const approved: ProofUpload = { ...example, approvedAt: new Date() };

describe("draftBlocker", () => {
  it("lets tried draft without any upload (first-look post)", () => {
    expect(draftBlocker({ type: "tried", uploads: [], hasDiagram: false })).toBeNull();
    expect(draftBlocker({ type: "tried", uploads: [emptyCode], hasDiagram: false })).toBeNull();
    expect(draftBlocker({ type: "tried", uploads: [image], hasDiagram: false })).toBeNull();
    expect(draftBlocker({ type: "tried", uploads: [code], hasDiagram: false })).toBeNull();
  });

  it("lets explain and lessons draft without proof (checked at finalize)", () => {
    expect(draftBlocker({ type: "explain", uploads: [], hasDiagram: false })).toBeNull();
    expect(draftBlocker({ type: "lessons", uploads: [], hasDiagram: false })).toBeNull();
  });

  it("blocks while an AI-written example waits for approval", () => {
    expect(draftBlocker({ type: "explain", uploads: [example], hasDiagram: false })).toMatch(/Approve/);
    expect(draftBlocker({ type: "explain", uploads: [approved], hasDiagram: false })).toBeNull();
  });
});

describe("proofMissing", () => {
  it("explain accepts a diagram, own upload or approved example", () => {
    expect(proofMissing({ type: "explain", uploads: [], hasDiagram: false })).toMatch(/diagram/);
    expect(proofMissing({ type: "explain", uploads: [example], hasDiagram: false })).toMatch(/diagram/);
    expect(proofMissing({ type: "explain", uploads: [], hasDiagram: true })).toBeNull();
    expect(proofMissing({ type: "explain", uploads: [approved], hasDiagram: false })).toBeNull();
    expect(proofMissing({ type: "explain", uploads: [image], hasDiagram: false })).toBeNull();
  });

  it("tried never requires proof", () => {
    expect(proofMissing({ type: "tried", uploads: [], hasDiagram: false })).toBeNull();
  });

  it("lessons depends on the real-situation check", () => {
    expect(proofMissing({ type: "lessons", uploads: [], hasDiagram: false })).toMatch(/not run/);
    expect(
      proofMissing({ type: "lessons", uploads: [], hasDiagram: false, realSituation: { ok: false, reason: "No example." } }),
    ).toMatch(/real situation.*No example\./);
    expect(
      proofMissing({ type: "lessons", uploads: [], hasDiagram: false, realSituation: { ok: true, reason: "" } }),
    ).toBeNull();
  });
});

describe("finalizeBlockers", () => {
  it("blocks on missing proof and on placeholders, and passes when both are fine", () => {
    expect(finalizeBlockers({ type: "explain", uploads: [], hasDiagram: false, draftTexts: ["ok"] })).toHaveLength(1);
    expect(finalizeBlockers({ type: "tried", uploads: [], hasDiagram: false, draftTexts: ["ok"] })).toEqual([]);
    expect(
      finalizeBlockers({ type: "tried", uploads: [image], hasDiagram: false, draftTexts: ["ok", "cut [ADD: number]"] }),
    ).toEqual(["Fill in or delete every [ADD: …] placeholder."]);
    expect(finalizeBlockers({ type: "tried", uploads: [image], hasDiagram: false, draftTexts: ["ok"] })).toEqual([]);
  });
});
