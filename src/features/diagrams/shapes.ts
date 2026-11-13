import {
  createShapeId,
  toRichText,
  type TLArrowBinding,
  type TLArrowShape,
  type TLBindingCreate,
  type TLGeoShape,
  type TLShapePartial,
} from "tldraw";
import type { DiagramSpec } from "@/db/schema";
import { layoutSpec } from "./layout";

export type ShapeInstructions = {
  /** Group regions first (they sit behind), then node boxes. */
  shapes: TLShapePartial<TLGeoShape>[];
  arrows: TLShapePartial<TLArrowShape>[];
  bindings: TLBindingCreate<TLArrowBinding>[];
};

export const nodeShapeId = (id: string) => createShapeId(`node-${id}`);

export function specToShapes(spec: DiagramSpec): ShapeInstructions {
  const layout = layoutSpec(spec);

  const regions: TLShapePartial<TLGeoShape>[] = layout.groups.map((g) => ({
    id: createShapeId(`group-${g.id}`),
    type: "geo",
    x: g.x,
    y: g.y,
    props: {
      geo: "rectangle",
      w: g.w,
      h: g.h,
      dash: "dashed",
      fill: "none",
      color: "grey",
      labelColor: "grey",
      font: "draw",
      size: "s",
      align: "start",
      verticalAlign: "end",
      richText: toRichText(g.label),
    },
  }));

  const boxes: TLShapePartial<TLGeoShape>[] = layout.nodes.map((n) => ({
    id: nodeShapeId(n.id),
    type: "geo",
    x: n.x,
    y: n.y,
    props: {
      geo: "rectangle",
      w: n.w,
      h: n.h,
      dash: "draw",
      fill: "semi",
      color: "black",
      font: "draw",
      size: "m",
      richText: toRichText(n.label),
    },
  }));

  const centre = new Map(layout.nodes.map((n) => [n.id, { x: n.x + n.w / 2, y: n.y + n.h / 2 }]));
  const arrows: TLShapePartial<TLArrowShape>[] = [];
  const bindings: TLBindingCreate<TLArrowBinding>[] = [];
  spec.edges.forEach((e, i) => {
    const a = centre.get(e.from);
    const b = centre.get(e.to);
    if (!a || !b) return;
    const id = createShapeId(`edge-${i}`);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    arrows.push({
      id,
      type: "arrow",
      x,
      y,
      props: {
        start: { x: a.x - x, y: a.y - y },
        end: { x: b.x - x, y: b.y - y },
        dash: "draw",
        color: "black",
        font: "draw",
        size: "m",
        richText: toRichText(e.label ?? ""),
      },
    });
    for (const [terminal, node] of [
      ["start", e.from],
      ["end", e.to],
    ] as const) {
      bindings.push({
        type: "arrow",
        fromId: id,
        toId: nodeShapeId(node),
        props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false },
      });
    }
  });

  return { shapes: [...regions, ...boxes], arrows, bindings };
}
