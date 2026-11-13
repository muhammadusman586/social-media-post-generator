import { describe, expect, it } from "vitest";
import { allPosted, formatThread, imagesFor, latestFinals, shareMode, xLength } from "./lib";

describe("xLength", () => {
  it("counts plain Latin text by length", () => {
    expect(xLength("hello world")).toBe(11);
  });

  it("counts each URL as 23 and keeps trailing punctuation out", () => {
    expect(xLength("see https://example.com/a/very/long/path?x=1")).toBe(4 + 23);
    expect(xLength("read https://a.co.")).toBe(5 + 23 + 1);
    expect(xLength("http://a.com http://b.com")).toBe(23 + 1 + 23);
  });

  it("counts emoji and CJK as 2", () => {
    expect(xLength("ok 👍")).toBe(5);
    expect(xLength("👨‍👩‍👧")).toBe(2);
    expect(xLength("日本")).toBe(4);
  });
});

describe("formatThread", () => {
  it("leaves a single post alone", () => {
    expect(formatThread(["  just one  "])).toEqual(["just one"]);
  });

  it("numbers thread posts n/N", () => {
    expect(formatThread(["a", "b", "c"])).toEqual(["a\n\n1/3", "b\n\n2/3", "c\n\n3/3"]);
  });

  it("does not double-number posts that already carry their marker", () => {
    expect(formatThread(["1/2 intro", "end 2/2"])).toEqual(["1/2 intro", "end 2/2"]);
  });

  it("drops empty posts before numbering", () => {
    expect(formatThread(["a", " ", "b"])).toEqual(["a\n\n1/2", "b\n\n2/2"]);
  });
});

const d = (platform: "linkedin" | "x" | "instagram", version: number, isFinal: boolean, postedAt: Date | null = null) => ({
  platform,
  version,
  isFinal,
  postedAt,
});

describe("latestFinals / allPosted", () => {
  it("picks the newest final per platform and ignores non-finals", () => {
    const finals = latestFinals([d("x", 1, true), d("x", 3, true), d("x", 4, false), d("linkedin", 1, false)]);
    expect(finals.x?.version).toBe(3);
    expect(finals.linkedin).toBeUndefined();
  });

  it("is posted only when every final is posted", () => {
    const now = new Date();
    expect(allPosted({})).toBe(false);
    expect(allPosted({ x: d("x", 1, true, now), linkedin: d("linkedin", 1, true) })).toBe(false);
    expect(allPosted({ x: d("x", 1, true, now), linkedin: d("linkedin", 1, true, now) })).toBe(true);
  });
});

describe("imagesFor", () => {
  const slides = [1, 2, 3, 4, 5].map((n) => ({ url: `/s${n}`, name: `s${n}.png` }));
  const diagram = { url: "/d", name: "d.png" };

  it("gives instagram the slides", () => {
    expect(imagesFor("instagram", slides, diagram)).toHaveLength(5);
  });

  it("gives linkedin slides first, else the diagram", () => {
    expect(imagesFor("linkedin", slides, diagram)).toHaveLength(5);
    expect(imagesFor("linkedin", [], diagram)).toEqual([diagram]);
    expect(imagesFor("linkedin", [], null)).toEqual([]);
  });

  it("gives x the diagram, else at most 4 slides", () => {
    expect(imagesFor("x", slides, diagram)).toEqual([diagram]);
    expect(imagesFor("x", slides, null)).toHaveLength(4);
  });
});

describe("shareMode", () => {
  const files = [new File(["x"], "a.png", { type: "image/png" })];

  it("shares when canShare accepts the files", () => {
    expect(shareMode({ canShare: () => true }, files)).toBe("share");
  });

  it("downloads when canShare is missing, refuses, throws, or there are no files", () => {
    expect(shareMode(undefined, files)).toBe("download");
    expect(shareMode({}, files)).toBe("download");
    expect(shareMode({ canShare: () => false }, files)).toBe("download");
    expect(
      shareMode(
        {
          canShare: () => {
            throw new TypeError();
          },
        },
        files,
      ),
    ).toBe("download");
    expect(shareMode({ canShare: () => true }, [])).toBe("download");
  });
});
