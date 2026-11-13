import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { slopFlags } from "@/db/schema";
import type { LintFlag } from "./lint";

/** Replace one source's flags on the given drafts. */
export async function replaceFlags(source: "lint" | "llm", rows: { draftId: string; flags: LintFlag[] }[]) {
  const db = getDb();
  const ids = rows.map((r) => r.draftId);
  if (!ids.length) return;
  const values = rows.flatMap((r) => r.flags.map((f) => ({ ...f, draftId: r.draftId, source })));
  const del = db.delete(slopFlags).where(and(inArray(slopFlags.draftId, ids), eq(slopFlags.source, source)));
  if (!values.length) return void (await del);
  await db.batch([del, db.insert(slopFlags).values(values)]);
}

export async function dismissFlag(id: string) {
  await getDb().update(slopFlags).set({ dismissed: true }).where(eq(slopFlags.id, id));
}
