import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { getSlideForRender } from "@/features/slides/queries";
import { renderSlide } from "@/features/slides/render";

/** 1080×1350 PNG of one slide. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/slides/[slideId]">) {
  await requireOwner();
  const { slideId } = await ctx.params;
  if (!z.uuid().safeParse(slideId).success) return new Response("Not found", { status: 404 });

  const data = await getSlideForRender(slideId);
  if (!data) return new Response("Not found", { status: 404 });

  return renderSlide({
    kind: data.slide.kind,
    content: data.slide.content,
    handle: data.handle,
    number: data.number,
    total: data.total,
    diagramPngUrl: data.diagramPngUrl,
  });
}
