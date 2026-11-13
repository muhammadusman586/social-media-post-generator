import { describe, expect, it } from "vitest";
import { pickQuickSource } from "./quick";

const radar = [{ id: "r1" }, { id: "r2" }];
const reflections = [{ id: "f1" }];

describe("pickQuickSource", () => {
  it("takes the top radar item in a normal week", () => {
    expect(pickQuickSource({ lessonsWeek: false, radar, reflections })).toEqual({ source: { kind: "radar", id: "r1" } });
  });

  it("takes a reflection in a lessons week", () => {
    expect(pickQuickSource({ lessonsWeek: true, radar, reflections })).toEqual({
      type: "lessons",
      source: { kind: "reflection", id: "f1" },
    });
  });

  it("falls back to the other source, then to null", () => {
    expect(pickQuickSource({ lessonsWeek: true, radar, reflections: [] })?.source.id).toBe("r1");
    expect(pickQuickSource({ lessonsWeek: false, radar: [], reflections })?.source.id).toBe("f1");
    expect(pickQuickSource({ lessonsWeek: false, radar: [], reflections: [] })).toBeNull();
  });
});
