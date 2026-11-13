import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { diagrams, drafts, posts, slides } from "@/db/schema";
import { latestFinals } from "./lib";

export async function getKit(postId: string) {
  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return null;

  const [draftRows, slideRows, [diagram]] = await Promise.all([
    db.select().from(drafts).where(eq(drafts.postId, postId)),
    db
      .select({ id: slides.id, pngUrl: slides.pngUrl })
      .from(slides)
      .where(eq(slides.postId, postId))
      .orderBy(asc(slides.order)),
    db.select({ pngUrl: diagrams.pngUrl }).from(diagrams).where(eq(diagrams.postId, postId)).limit(1),
  ]);

  return {
    post,
    finals: latestFinals(draftRows),
    slides: slideRows,
    diagramPngUrl: diagram?.pngUrl ?? null,
  };
}

export async function getFinalDrafts(postId: string) {
  return latestFinals(await getDb().select().from(drafts).where(eq(drafts.postId, postId)));
}
