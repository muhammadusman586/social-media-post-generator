import { describe, expect, it } from "vitest";
import type { DiagramSpec } from "@/db/schema";
import { nodeShapeId, specToShapes } from "./shapes";

const spec: DiagramSpec = {
  nodes: [
    { id: "a", label: "Agent", group: "g" },
    { id: "b", label: "Memory store" },
  ],
  edges: [{ from: "a", to: "b", label: "writes" }],
  groups: [{ id: "g", label: "Runtime" }],
};

describe("specToShapes", () => {
  const { shapes, arrows, bindings } = specToShapes(spec);

  it("makes a region per group (first, so it sits behind) and a hand-drawn box per node", () => {
    expect(shapes.map((s) => s.id)).toEqual(["shape:group-g", "shape:node-a", "shape:node-b"]);
    expect(shapes[0].props).toMatchObject({ geo: "rectangle", dash: "dashed", verticalAlign: "end" });
    for (const box of shapes.slice(1)) expect(box.props).toMatchObject({ geo: "rectangle", dash: "draw", font: "draw" });
    expect(JSON.stringify(shapes[1].props?.richText)).toContain("Agent");
  });

  it("makes one labelled arrow per edge from centre to centre", () => {
    expect(arrows).toHaveLength(1);
    const [arrow] = arrows;
    const a = shapes[1];
    const b = shapes[2];
    const start = { x: arrow.x! + arrow.props!.start!.x, y: arrow.y! + arrow.props!.start!.y };
    const end = { x: arrow.x! + arrow.props!.end!.x, y: arrow.y! + arrow.props!.end!.y };
    expect(start).toEqual({ x: a.x! + a.props!.w! / 2, y: a.y! + a.props!.h! / 2 });
    expect(end).toEqual({ x: b.x! + b.props!.w! / 2, y: b.y! + b.props!.h! / 2 });
    expect(JSON.stringify(arrow.props?.richText)).toContain("writes");
    expect(arrow.props).toMatchObject({ dash: "draw", font: "draw" });
  });

  it("binds both arrow ends to existing node shapes", () => {
    const ids = new Set(shapes.map((s) => s.id));
    expect(bindings).toEqual([
      expect.objectContaining({ type: "arrow", fromId: arrows[0].id, toId: nodeShapeId("a"), props: expect.objectContaining({ terminal: "start" }) }),
      expect.objectContaining({ type: "arrow", fromId: arrows[0].id, toId: nodeShapeId("b"), props: expect.objectContaining({ terminal: "end" }) }),
    ]);
    expect(bindings.every((b) => ids.has(b.toId))).toBe(true);
  });
});
