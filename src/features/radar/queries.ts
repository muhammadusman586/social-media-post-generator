import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Latest run (for its status) and the shortlist of the latest finished run. */
export async function getRadarView() {
  const db = getDb();
  const [latest, lastDone] = await Promise.all([
    db.query.radarRuns.findFirst({ orderBy: desc(schema.radarRuns.startedAt) }),
    db.query.radarRuns.findFirst({
      where: eq(schema.radarRuns.status, "done"),
      orderBy: desc(schema.radarRuns.startedAt),
      with: { items: { orderBy: desc(schema.radarItems.score) } },
    }),
  ]);
  return { latest, lastDone };
}

export function listSources() {
  return getDb().select().from(schema.sources).orderBy(asc(schema.sources.createdAt), asc(schema.sources.name));
}

/** For other features (e.g. posts/new?radarItemId=...). */
export function getRadarItem(id: string) {
  return getDb().query.radarItems.findFirst({ where: eq(schema.radarItems.id, id) });
}
