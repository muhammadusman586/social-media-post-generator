import { describe, expect, it } from "vitest";
import { pickableReflections, showLessonsEntry } from "./lessons";

describe("showLessonsEntry", () => {
  it("shows only on a lessons week without a post", () => {
    expect(showLessonsEntry("lessons", false)).toBe(true);
    expect(showLessonsEntry("lessons", true)).toBe(false);
    expect(showLessonsEntry("explain", false)).toBe(false);
    expect(showLessonsEntry("tried", false)).toBe(false);
  });
});

describe("pickableReflections", () => {
  it("keeps answered, unused reflections", () => {
    const rows = [
      { id: "a", answer: "real answer", used: false },
      { id: "b", answer: null, used: false },
      { id: "c", answer: "  ", used: false },
      { id: "d", answer: "used already", used: true },
    ];
    expect(pickableReflections(rows).map((r) => r.id)).toEqual(["a"]);
  });
});
