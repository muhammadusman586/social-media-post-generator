import { describe, expect, it } from "vitest";
import { MAX_NODES, normalizeSpec, proposalSchema, type LlmSpec } from "./spec";

const node = (id: string, group: string | null = null) => ({ id, label: `Box ${id}`, group });

describe("normalizeSpec", () => {
  it("keeps a clean spec and turns nulls into missing keys", () => {
    const raw: LlmSpec = {
      title: "Flow",
      nodes: [node("a", "g1"), node("b")],
      edges: [{ from: "a", to: "b", label: null }],
      groups: [{ id: "g1", label: "Client" }],
    };
    expect(normalizeSpec(raw)).toEqual({
      title: "Flow",
      nodes: [{ id: "a", label: "Box a", group: "g1" }, { id: "b", label: "Box b" }],
      edges: [{ from: "a", to: "b" }],
      groups: [{ id: "g1", label: "Client" }],
    });
  });

  it("drops bad edges, duplicate nodes, unknown and unused groups", () => {
    const out = normalizeSpec({
      title: " ",
      nodes: [node("a", "ghost"), node("a"), node("b"), { id: "c", label: "  ", group: null }],
      edges: [
        { from: "a", to: "b", label: "calls" },
        { from: "a", to: "b", label: "dup" },
        { from: "a", to: "a", label: null },
        { from: "a", to: "zzz", label: null },
      ],
      groups: [{ id: "unused", label: "Nobody" }],
    });
    expect(out.title).toBeUndefined();
    expect(out.nodes).toEqual([{ id: "a", label: "Box a" }, { id: "b", label: "Box b" }]);
    expect(out.edges).toEqual([{ from: "a", to: "b", label: "calls" }]);
    expect(out.groups).toBeUndefined();
  });

  it("caps the node count", () => {
    const nodes = Array.from({ length: MAX_NODES + 5 }, (_, i) => node(`n${i}`));
    expect(normalizeSpec({ title: null, nodes, edges: [], groups: [] }).nodes).toHaveLength(MAX_NODES);
  });

  it("throws when nothing is left", () => {
    expect(() => normalizeSpec({ title: null, nodes: [], edges: [], groups: [] })).toThrow();
  });
});

describe("proposalSchema", () => {
  it("accepts a 'not useful' answer and rejects missing keys", () => {
    expect(proposalSchema.safeParse({ useful: false, reason: "It's an opinion.", diagram: null }).success).toBe(true);
    expect(proposalSchema.safeParse({ useful: true, reason: "x" }).success).toBe(false);
  });
});
