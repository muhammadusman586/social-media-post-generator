import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { posts, radarItems, radarRuns, reflections } from "@/db/schema";
import { weekOf } from "@/lib/week";
import { decideNewPost, isUuid, type NewPostInput, type SourceRow } from "./new-post";

export async function getWeekPost(week: string = weekOf()) {
  const [row] = await getDb()
    .select()
    .from(posts)
    .where(eq(posts.weekOf, week))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return row;
}

export async function listPosts(search = "") {
  const q = search.trim().replace(/[\\%_]/g, "\\$&");
  return getDb()
    .select({ id: posts.id, type: posts.type, status: posts.status, weekOf: posts.weekOf, title: posts.title })
    .from(posts)
    .where(q ? ilike(posts.title, `%${q}%`) : undefined)
    .orderBy(desc(posts.weekOf), desc(posts.createdAt))
    .limit(200);
}

export async function getPostOverview(id: string) {
  if (!isUuid(id)) return undefined;
  return getDb().query.posts.findFirst({
    where: eq(posts.id, id),
    with: {
      radarItem: { columns: { title: true, url: true } },
      reflection: { columns: { question: true } },
      interviewQas: { columns: { answer: true } },
      drafts: { columns: { isFinal: true, postedAt: true } },
      diagram: { columns: { pngUrl: true } },
    },
  });
}

/**
 * Top unused items of the latest finished radar run.
 * shortcut: reads radar tables directly because the radar feature's queries.ts did not
 * exist yet; switch to its shortlist query after merge.
 */
export async function getRadarShortlist(limit = 3) {
  const db = getDb();
  const [run] = await db
    .select({ id: radarRuns.id })
    .from(radarRuns)
    .where(and(eq(radarRuns.status, "done"), isNull(radarRuns.topic)))
    .orderBy(desc(radarRuns.startedAt))
    .limit(1);
  if (!run) return [];
  return db
    .select()
    .from(radarItems)
    .where(and(eq(radarItems.runId, run.id), eq(radarItems.used, false)))
    .orderBy(desc(radarItems.score))
    .limit(limit);
}

async function findSource(input: NewPostInput): Promise<SourceRow | undefined> {
  const db = getDb();
  const { kind, id } = input.source;
  if (kind === "radar") {
    const [r] = await db
      .select({ title: radarItems.title, suggestedType: radarItems.suggestedType })
      .from(radarItems)
      .where(eq(radarItems.id, id));
    return r && { title: r.title, suggestedType: r.suggestedType, answered: false };
  }
  const [r] = await db
    .select({ question: reflections.question, answer: reflections.answer })
    .from(reflections)
    .where(eq(reflections.id, id));
  return r && { title: r.question, answered: Boolean(r.answer?.trim()) };
}

async function findPostFor(input: NewPostInput) {
  const { kind, id } = input.source;
  const [row] = await getDb()
    .select({ id: posts.id })
    .from(posts)
    .where(eq(kind === "radar" ? posts.radarItemId : posts.reflectionId, id))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return row?.id;
}

/**
 * Creates the post for `/posts/new`, or returns the post that already exists for the
 * same radar item / reflection. Call only after requireOwner().
 */
export async function startPost(input: NewPostInput): Promise<{ postId: string; created: boolean } | { error: string }> {
  const [source, existing] = await Promise.all([findSource(input), findPostFor(input)]);
  const decision = decideNewPost(input, source, existing);
  if (decision.action === "error") return { error: decision.error };
  if (decision.action === "existing") return { postId: decision.postId, created: false };

  const db = getDb();
  const { kind, id } = input.source;
  const week = weekOf();
  // One statement: flip `used` false -> true and insert the post only if this request won
  // the flip. A concurrent request blocks on the row lock, then sees used = true.
  const claimed = await db.execute<{ id: string }>(
    kind === "radar"
      ? sql`with claimed as (
          update radar_items set used = true where id = ${id} and used = false returning id
        )
        insert into posts (type, status, week_of, title, radar_item_id)
        select ${decision.type}::post_type, 'interview', ${week}::date, ${decision.title}, claimed.id from claimed
        returning id`
      : sql`with claimed as (
          update reflections set used = true where id = ${id} and used = false and answer is not null returning id
        )
        insert into posts (type, status, week_of, title, reflection_id)
        select 'lessons', 'interview', ${week}::date, ${decision.title}, claimed.id from claimed
        returning id`,
  );
  const createdId = claimed.rows[0]?.id;
  if (createdId) return { postId: createdId, created: true };

  // Lost the flip: the winner's post is committed by now.
  const winner = await findPostFor(input);
  if (winner) return { postId: winner, created: false };

  // Marked used but no post points at it (its post was deleted): start a fresh one.
  const [row] = await db
    .insert(posts)
    .values({
      type: decision.type,
      status: "interview",
      weekOf: week,
      title: decision.title,
      ...(kind === "radar" ? { radarItemId: id } : { reflectionId: id }),
    })
    .returning({ id: posts.id });
  return { postId: row.id, created: true };
}
