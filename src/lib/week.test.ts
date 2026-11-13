import { describe, expect, it } from "vitest";
import { defaultPostType, weekOf } from "./week";

describe("weekOf", () => {
  it("returns the Monday of the current week", () => {
    expect(weekOf(new Date("2026-11-13T09:00:00Z"))).toBe("2026-11-09");
    expect(weekOf(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09"); // Monday 05:00 PKT
  });

  it("uses Asia/Karachi, not UTC", () => {
    // Sunday 20:00 UTC is already Monday 01:00 in Karachi.
    expect(weekOf(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-16");
    // Sunday 18:59 UTC is still Sunday 23:59 in Karachi.
    expect(weekOf(new Date("2026-11-15T18:59:00Z"))).toBe("2026-11-09");
  });

  it("crosses month and year boundaries", () => {
    expect(weekOf(new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-28");
  });
});

describe("defaultPostType", () => {
  it("follows the rotation by week of month", () => {
    expect(defaultPostType("2026-11-02")).toBe("explain");
    expect(defaultPostType("2026-11-09")).toBe("tried");
    expect(defaultPostType("2026-11-16")).toBe("explain");
    expect(defaultPostType("2026-11-23")).toBe("lessons");
    expect(defaultPostType("2026-11-30")).toBe("lessons");
  });
});
