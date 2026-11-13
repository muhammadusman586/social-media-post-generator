import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { diagrams, profile, slides } from "@/db/schema";

export async function getSlideForRender(slideId: string) {
  const db = getDb();
  const [slide] = await db.select().from(slides).where(eq(slides.id, slideId)).limit(1);
  if (!slide) return null;

  const [siblings, [diagram], [owner]] = await Promise.all([
    db.select({ id: slides.id }).from(slides).where(eq(slides.postId, slide.postId)).orderBy(asc(slides.order)),
    db.select({ pngUrl: diagrams.pngUrl }).from(diagrams).where(eq(diagrams.postId, slide.postId)).limit(1),
    db.select({ handle: profile.handle }).from(profile).limit(1),
  ]);

  return {
    slide,
    number: siblings.findIndex((s) => s.id === slide.id) + 1,
    total: siblings.length,
    diagramPngUrl: diagram?.pngUrl ?? null,
    handle: owner?.handle ?? "",
  };
}
