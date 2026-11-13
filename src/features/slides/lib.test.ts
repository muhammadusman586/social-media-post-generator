import { describe, expect, it } from "vitest";
import { fitFontSize, slideTemplate } from "./lib";

describe("slideTemplate", () => {
  it("uses the kind's own template when its content is there", () => {
    expect(slideTemplate("title", { heading: "Hi" })).toBe("title");
    expect(slideTemplate("code", { code: "let a = 1" })).toBe("code");
    expect(slideTemplate("quote", { quote: "Ship it" })).toBe("quote");
    expect(slideTemplate("diagram", { imageUrl: "https://x/a.png" })).toBe("diagram");
  });

  it("uses the post's diagram png for diagram slides", () => {
    expect(slideTemplate("diagram", {}, "https://blob/d.png")).toBe("diagram");
  });

  it("falls back to text when the needed field is missing", () => {
    expect(slideTemplate("diagram", { heading: "x" }, null)).toBe("text");
    expect(slideTemplate("code", { code: "  " })).toBe("text");
    expect(slideTemplate("quote", {})).toBe("text");
  });
});

describe("fitFontSize", () => {
  it("keeps short text at max and long text at min", () => {
    expect(fitFontSize("short", 64, 32)).toBe(64);
    expect(fitFontSize("x".repeat(1000), 64, 32)).toBe(32);
    const mid = fitFontSize("x".repeat(330), 64, 32);
    expect(mid).toBeLessThan(64);
    expect(mid).toBeGreaterThan(32);
  });
});
