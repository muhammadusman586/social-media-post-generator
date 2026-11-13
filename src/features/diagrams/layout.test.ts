import { describe, expect, it } from "vitest";
import type { DiagramSpec } from "@/db/schema";
import { layoutSpec, portraitBox, rankNodes, type Box } from "./layout";

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

const grouped: DiagramSpec = {
  nodes: [
    { id: "ui", label: "Chat UI", group: "client" },
    { id: "hook", label: "useChat hook", group: "client" },
    { id: "route", label: "API route", group: "server" },
    { id: "model", label: "Model", group: "server" },
    { id: "tool", label: "Tool call", group: "server" },
    { id: "db", label: "Database" },
    { id: "log", label: "Logs" },
  ],
  edges: [
    { from: "ui", to: "hook" },
    { from: "hook", to: "route", label: "POST" },
    { from: "route", to: "model" },
    { from: "route", to: "tool" },
    { from: "tool", to: "db" },
    { from: "model", to: "hook", label: "stream" }, // cycle back
    { from: "model", to: "log" },
  ],
  groups: [
    { id: "client", label: "Client" },
    { id: "server", label: "Server" },
  ],
};

const cases: [string, DiagramSpec][] = [
  ["grouped with a cycle", grouped],
  ["single node", { nodes: [{ id: "a", label: "A" }], edges: [] }],
  [
    "wide fan-out, no groups",
    {
      nodes: ["root", "a", "b", "c", "d"].map((id) => ({ id, label: id })),
      edges: ["a", "b", "c", "d"].map((to) => ({ from: "root", to })),
    },
  ],
];

describe.each(cases)("layoutSpec: %s", (_, spec) => {
  const layout = layoutSpec(spec);

  it("places every node exactly once", () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(spec.nodes.map((n) => n.id).sort());
  });

  it("has no overlapping nodes or groups", () => {
    const boxes: Box[] = [...layout.nodes, ...layout.groups];
    for (let i = 0; i < layout.nodes.length; i++)
      for (let j = i + 1; j < layout.nodes.length; j++) expect(overlaps(layout.nodes[i], layout.nodes[j])).toBe(false);
    for (let i = 0; i < layout.groups.length; i++)
      for (let j = i + 1; j < layout.groups.length; j++) expect(overlaps(layout.groups[i], layout.groups[j])).toBe(false);
    expect(boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= layout.width && b.y + b.h <= layout.height)).toBe(true);
  });

  it("puts each grouped node inside its own group and outside the others", () => {
    for (const n of spec.nodes) {
      const placed = layout.nodes.find((p) => p.id === n.id)!;
      for (const g of layout.groups) {
        if (g.id === n.group) expect(inside(placed, g)).toBe(true);
        else expect(overlaps(placed, g)).toBe(false);
      }
    }
  });

  it("only has edges between placed nodes", () => {
    const ids = new Set(layout.nodes.map((n) => n.id));
    expect(spec.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
  });
});

describe("rankNodes", () => {
  it("puts targets below sources and survives cycles", () => {
    const rank = rankNodes(grouped);
    expect(rank.get("ui")).toBe(0);
    expect(rank.get("hook")).toBe(1);
    expect(rank.get("route")).toBe(2);
    expect(rank.get("db")).toBe(4);
  });
});

describe("portraitBox", () => {
  it("pads and widens a tall box to 4:5, keeping the centre", () => {
    const b = portraitBox({ x: 0, y: 0, w: 100, h: 1000 }, 0);
    expect(b.w / b.h).toBeCloseTo(1080 / 1350);
    expect(b.x + b.w / 2).toBeCloseTo(50);
    expect(b.h).toBe(1000);
  });

  it("makes a wide box taller", () => {
    const b = portraitBox({ x: 0, y: 0, w: 1000, h: 100 }, 10);
    expect(b.w).toBe(1020);
    expect(b.w / b.h).toBeCloseTo(1080 / 1350);
  });
});
