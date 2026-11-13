import type { DiagramSpec } from "@/db/schema";

export type Box = { x: number; y: number; w: number; h: number };
export type PlacedNode = Box & { id: string; label: string };
export type PlacedGroup = Box & { id: string; label: string };
export type DiagramLayout = { nodes: PlacedNode[]; groups: PlacedGroup[]; width: number; height: number };

export const NODE_W = 240;
export const NODE_H = 110;
const GAP_X = 60;
/** Room for arrow labels between layers. */
const GAP_Y = 120;
const GROUP_PAD = 30;
/** Label sits bottom-left: arrows usually enter a group from the top. */
const GROUP_LABEL = 50;

/** Layer of each node: longest path from a root, with back edges (cycles) ignored. */
export function rankNodes(spec: DiagramSpec): Map<string, number> {
  const out = new Map(spec.nodes.map((n) => [n.id, [] as string[]]));
  for (const e of spec.edges) out.get(e.from)?.push(e.to);

  // DFS marks back edges so cycles don't push ranks up forever.
  const state = new Map<string, 1 | 2>();
  const forward: [string, string][] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    for (const to of out.get(id) ?? []) {
      if (!out.has(to) || state.get(to) === 1) continue;
      forward.push([id, to]);
      if (!state.has(to)) visit(to);
    }
    state.set(id, 2);
  };
  for (const n of spec.nodes) if (!state.has(n.id)) visit(n.id);

  const rank = new Map(spec.nodes.map((n) => [n.id, 0]));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [from, to] of forward) {
      if (rank.get(to)! < rank.get(from)! + 1) {
        rank.set(to, rank.get(from)! + 1);
        changed = true;
      }
    }
  }
  return rank;
}

/**
 * Top-down layered layout for a portrait slide. Each group gets its own column band
 * (ungrouped nodes share a last band), so group regions never overlap each other or
 * other nodes. Nodes sit in rows by rank, centred in their band.
 */
export function layoutSpec(spec: DiagramSpec): DiagramLayout {
  const rank = rankNodes(spec);
  const layers = Math.max(...rank.values()) + 1;
  const groups = (spec.groups ?? []).filter((g) => spec.nodes.some((n) => n.group === g.id));
  const hasGroups = groups.length > 0;
  const top = hasGroups ? GROUP_PAD : 0;
  const rowY = (r: number) => top + r * (NODE_H + GAP_Y);

  const bands: { group?: (typeof groups)[number]; members: DiagramSpec["nodes"] }[] = groups.map((g) => ({
    group: g,
    members: spec.nodes.filter((n) => n.group === g.id),
  }));
  const loose = spec.nodes.filter((n) => !groups.some((g) => g.id === n.group));
  if (loose.length) bands.push({ members: loose });

  const nodes: PlacedNode[] = [];
  const placedGroups: PlacedGroup[] = [];
  let x = 0;
  for (const band of bands) {
    const rows = Array.from({ length: layers }, (_, r) => band.members.filter((n) => rank.get(n.id) === r));
    const slots = Math.max(...rows.map((row) => row.length));
    const innerW = slots * NODE_W + (slots - 1) * GAP_X;
    const pad = band.group ? GROUP_PAD : 0;
    rows.forEach((row, r) => {
      const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
      row.forEach((n, i) => {
        nodes.push({
          id: n.id,
          label: n.label,
          x: x + pad + (innerW - rowW) / 2 + i * (NODE_W + GAP_X),
          y: rowY(r),
          w: NODE_W,
          h: NODE_H,
        });
      });
    });
    if (band.group) {
      const used = rows.flatMap((row, r) => (row.length ? [r] : []));
      const y = rowY(used[0]) - GROUP_PAD;
      placedGroups.push({
        id: band.group.id,
        label: band.group.label,
        x,
        y,
        w: innerW + 2 * pad,
        h: rowY(used[used.length - 1]) + NODE_H + GROUP_LABEL - y,
      });
    }
    x += innerW + 2 * pad + GAP_X;
  }

  const height = Math.max(...nodes.map((n) => n.y + n.h), ...placedGroups.map((g) => g.y + g.h));
  return { nodes, groups: placedGroups, width: x - GAP_X, height };
}

/** Grows `b` (plus padding) to the 1080x1350 slide ratio, keeping it centred. */
export function portraitBox(b: Box, padding = 48, ratio = 1080 / 1350): Box {
  let w = b.w + padding * 2;
  let h = b.h + padding * 2;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
}
