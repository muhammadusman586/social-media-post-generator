import { z } from "zod";
import type { DiagramSpec } from "@/db/schema";

/** More boxes than this stops reading on a phone-sized slide. */
export const MAX_NODES = 12;

// OpenAI strict structured output needs every key present, so "optional" fields are nullable.
export const llmSpecSchema = z.object({
  title: z.string().nullable().describe("Short diagram title, or null"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("Short unique id, e.g. n1"),
        label: z.string().describe("2-5 words taken from the material"),
        group: z.string().nullable().describe("id of a group, or null"),
      }),
    )
    .describe(`2 to ${MAX_NODES} boxes`),
  edges: z.array(
    z.object({
      from: z.string().describe("node id"),
      to: z.string().describe("node id"),
      label: z.string().nullable().describe("1-3 words, or null"),
    }),
  ),
  groups: z.array(z.object({ id: z.string(), label: z.string() })).describe("May be empty"),
});

export const proposalSchema = z.object({
  useful: z.boolean().describe("True only if a diagram explains this post better than text"),
  reason: z.string().describe("One plain sentence on why or why not"),
  diagram: llmSpecSchema.nullable().describe("The diagram, or null when not useful"),
});

export type LlmSpec = z.infer<typeof llmSpecSchema>;

/**
 * Turns model output into a DiagramSpec the layout can trust: unique node ids, at most
 * MAX_NODES nodes, edges and group refs only to things that exist, no self-loops or
 * duplicate edges, unused groups dropped. Throws when no node survives.
 */
export function normalizeSpec(raw: LlmSpec): DiagramSpec {
  const nodes: DiagramSpec["nodes"] = [];
  const seen = new Set<string>();
  for (const n of raw.nodes) {
    const id = n.id.trim();
    const label = n.label.trim();
    if (!id || !label || seen.has(id) || nodes.length >= MAX_NODES) continue;
    seen.add(id);
    nodes.push({ id, label, ...(n.group?.trim() ? { group: n.group.trim() } : {}) });
  }
  if (nodes.length === 0) throw new Error("The diagram has no boxes.");

  const groupIds = new Set(raw.groups.map((g) => g.id.trim()));
  for (const n of nodes) if (n.group && !groupIds.has(n.group)) delete n.group;
  const used = new Set(nodes.map((n) => n.group).filter(Boolean));
  const groups: NonNullable<DiagramSpec["groups"]> = [];
  for (const g of raw.groups) {
    const id = g.id.trim();
    if (used.has(id) && !groups.some((x) => x.id === id)) groups.push({ id, label: g.label.trim() || id });
  }

  const edges: DiagramSpec["edges"] = [];
  const edgeKeys = new Set<string>();
  for (const e of raw.edges) {
    const from = e.from.trim();
    const to = e.to.trim();
    const key = `${from}->${to}`;
    if (from === to || !seen.has(from) || !seen.has(to) || edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, ...(e.label?.trim() ? { label: e.label.trim() } : {}) });
  }

  return {
    ...(raw.title?.trim() ? { title: raw.title.trim() } : {}),
    nodes,
    edges,
    ...(groups.length ? { groups } : {}),
  };
}
