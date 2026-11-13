import { and, desc, eq, inArray, max } from "drizzle-orm";
import { getDb } from "@/db";
import {
  drafts,
  posts,
  profile,
  slides,
  voiceExamples,
  type DraftContent,
  type Platform,
  type SlideContent,
} from "@/db/schema";
import { getInterview, type Interview } from "@/features/interview/queries";
import type { DraftContext } from "./prompt";
import type { SlideKind } from "./generate";

/** Everything a draft may be built from, plus the post row. Null when the post is missing. */
export async function getDraftContext(postId: string): Promise<{ post: Interview; ctx: DraftContext } | null> {
  const db = getDb();
  const [post, [owner], samples, finals] = await Promise.all([
    getInterview(postId),
    db.select().from(profile).limit(1),
    db.select({ text: voiceExamples.text }).from(voiceExamples).where(eq(voiceExamples.source, "sample")).orderBy(desc(voiceExamples.createdAt)).limit(6),
    db.select({ text: voiceExamples.text }).from(voiceExamples).where(eq(voiceExamples.source, "final_post")).orderBy(desc(voiceExamples.createdAt)).limit(3),
  ]);
  if (!post) return null;
  return {
    post,
    ctx: {
      post: { type: post.type, title: post.title },
      profile: owner ?? null,
      voice: [...finals, ...samples].map((v) => v.text),
      item: post.radarItem,
      reflection: post.reflection,
      qas: post.interviewQas,
      uploads: post.uploads,
      hasDiagram: Boolean(post.diagram),
    },
  };
}

/** Latest version per platform, with its slop flags. */
export async function getLatestDrafts(postId: string) {
  const rows = await getDb().query.drafts.findMany({
    where: eq(drafts.postId, postId),
    orderBy: [desc(drafts.version)],
    with: { slopFlags: { orderBy: (f, { asc }) => [asc(f.createdAt)] } },
  });
  const latest = new Map<Platform, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.platform)) latest.set(row.platform, row);
  return latest;
}

export type LatestDraft = NonNullable<ReturnType<Awaited<ReturnType<typeof getLatestDrafts>>["get"]>>;

export async function getSlides(postId: string) {
  return getDb().select().from(slides).where(eq(slides.postId, postId)).orderBy(slides.order);
}

/** Insert the next version for a platform. */
export async function insertDraft(postId: string, platform: Platform, content: DraftContent) {
  const db = getDb();
  const [{ v }] = await db
    .select({ v: max(drafts.version) })
    .from(drafts)
    .where(and(eq(drafts.postId, postId), eq(drafts.platform, platform)));
  const [row] = await db
    .insert(drafts)
    .values({ postId, platform, content, version: (v ?? 0) + 1 })
    .returning();
  return row;
}

/** Replace the post's slides. PNGs are rendered later by the slides feature. */
export async function replaceSlides(postId: string, next: { kind: SlideKind; content: SlideContent }[]) {
  const db = getDb();
  const del = db.delete(slides).where(eq(slides.postId, postId));
  if (!next.length) return void (await del);
  await db.batch([
    del,
    db.insert(slides).values(next.map((s, i) => ({ postId, order: i + 1, kind: s.kind, content: s.content }))),
  ]);
}

/** Status 'drafted' after the first generation (never moves a post backwards). */
export async function markDrafted(postId: string) {
  await getDb()
    .update(posts)
    .set({ status: "drafted" })
    .where(and(eq(posts.id, postId), inArray(posts.status, ["draft", "interview"])));
}

/** Mark the given drafts final and store their text as voice examples. */
export async function finalizeDrafts(postId: string, finals: { id: string; platform: Platform; text: string }[]) {
  const db = getDb();
  await db.batch([
    db.update(drafts).set({ isFinal: false }).where(eq(drafts.postId, postId)),
    db.update(drafts).set({ isFinal: true }).where(inArray(drafts.id, finals.map((f) => f.id))),
    db.delete(voiceExamples).where(and(eq(voiceExamples.postId, postId), eq(voiceExamples.source, "final_post"))),
    db.insert(voiceExamples).values(finals.map((f) => ({ text: f.text, source: "final_post" as const, postId, platform: f.platform }))),
  ]);
}
