import { describe, expect, it } from "vitest";
import { formatThread, parseThread, stripNumbering, X_LIMIT, xIssues, xLength, xLimit } from "./x";

describe("xLength", () => {
  it("counts code points, so an emoji is one character", () => {
    expect(xLength("hi")).toBe(2);
    expect(xLength("🚀")).toBe(1);
  });
});

describe("parseThread / formatThread", () => {
  it("round-trips a thread", () => {
    const posts = ["First post.", "Second\nwith two lines.", "Third."];
    expect(parseThread(formatThread(posts))).toEqual(posts);
  });

  it("splits only on lines that are exactly ---, trimming and dropping empties", () => {
    expect(parseThread("a\n---\n\n  ---  \nb --- c\n---\n")).toEqual(["a", "b --- c"]);
  });

  it("treats text without separators as a single post", () => {
    expect(parseThread("  just one  ")).toEqual(["just one"]);
    expect(parseThread("")).toEqual([]);
  });
});

describe("xIssues", () => {
  it("allows a single post up to 280 characters", () => {
    expect(xIssues(["a".repeat(X_LIMIT)])).toEqual([]);
  });

  it("flags a single post over 280 with how much to cut", () => {
    const issues = xIssues(["b".repeat(290)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("X post over 280 characters");
    expect(issues[0].quote).toMatch(/^Post 1: b+…$/);
    expect(issues[0].suggestion).toContain("Cut 10 characters");
  });

  it("leaves room for the kit's ' i/n' numbering in threads", () => {
    expect(xLimit(1)).toBe(280);
    expect(xLimit(4)).toBe(276);
    expect(xLimit(12)).toBe(274);
    expect(xIssues(["ok", "a".repeat(276), "c"])).toEqual([]);
    const issues = xIssues(["ok", "a".repeat(277), "c"]);
    expect(issues.map((i) => i.rule)).toEqual(["X post over 276 characters"]);
    expect(issues[0].quote).toMatch(/^Post 2: /);
  });

  it("allows threads of 3 to 6 posts only", () => {
    expect(xIssues(["1", "2"]).map((i) => i.rule)).toEqual(["X thread length"]);
    expect(xIssues(["1", "2", "3", "4", "5", "6"])).toEqual([]);
    expect(xIssues(["1", "2", "3", "4", "5", "6", "7"]).map((i) => i.rule)).toEqual(["X thread length"]);
  });
});

describe("stripNumbering", () => {
  it("removes leading or trailing i/n numbering only", () => {
    expect(stripNumbering("1/4 First post")).toBe("First post");
    expect(stripNumbering("(2/4) Second")).toBe("Second");
    expect(stripNumbering("Third post 3/4")).toBe("Third post");
    expect(stripNumbering("Ran 3/4 tests green")).toBe("Ran 3/4 tests green");
  });
});
