import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { diagrams, type DiagramSpec } from "@/db/schema";

/** The diagram row for a post, or undefined. Other features (slides) read `pngUrl` from here. */
export async function getDiagram(postId: string) {
  return getDb().query.diagrams.findFirst({ where: (d, { eq }) => eq(d.postId, postId) });
}

/** Post + the material the diagram may use + the current diagram. */
export async function getDiagramPageData(postId: string) {
  return getDb().query.posts.findFirst({
    where: (p, { eq }) => eq(p.id, postId),
    with: {
      radarItem: true,
      reflection: true,
      interviewQas: { orderBy: (q, { asc }) => [asc(q.order)] },
      diagram: true,
    },
  });
}

/** New spec replaces the old canvas and export, so the editor redraws from it. */
export async function upsertDiagramSpec(postId: string, spec: DiagramSpec) {
  const fresh = { spec, tldrawSnapshot: null, pngUrl: null };
  const [row] = await getDb()
    .insert(diagrams)
    .values({ postId, ...fresh })
    .onConflictDoUpdate({ target: diagrams.postId, set: { ...fresh, updatedAt: new Date() } })
    .returning();
  return row;
}

export async function saveDiagramSnapshot(postId: string, snapshot: unknown) {
  await getDb().update(diagrams).set({ tldrawSnapshot: snapshot }).where(eq(diagrams.postId, postId));
}

export async function setDiagramPng(postId: string, pngUrl: string) {
  await getDb().update(diagrams).set({ pngUrl }).where(eq(diagrams.postId, postId));
}
