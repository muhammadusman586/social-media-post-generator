import { describe, expect, it } from "vitest";
import { parseTags } from "./tags";

describe("parseTags", () => {
  it("splits on commas and newlines and trims", () => {
    expect(parseTags(" Next.js, Vercel AI SDK\nNeon ,, \n")).toEqual(["Next.js", "Vercel AI SDK", "Neon"]);
  });

  it("drops duplicates ignoring case, keeping the first spelling", () => {
    expect(parseTags("OpenAI, openai, OPENAI, Clerk")).toEqual(["OpenAI", "Clerk"]);
  });

  it("collapses inner whitespace and handles empty input", () => {
    expect(parseTags("Acme   Corp")).toEqual(["Acme Corp"]);
    expect(parseTags("")).toEqual([]);
  });

  it("caps tag length and count", () => {
    expect(parseTags("x".repeat(200))[0]).toHaveLength(80);
    expect(parseTags(Array.from({ length: 80 }, (_, i) => `t${i}`).join(","))).toHaveLength(50);
  });
});
