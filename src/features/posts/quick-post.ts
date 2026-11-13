"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { interviewQas, posts, profile, radarItems, radarRuns, reflections } from "@/db/schema";
import { proposeDiagram } from "@/features/diagrams/actions";
import { draftAllPlatforms } from "@/features/drafts/generate-all";
import { getFirecrawl } from "@/features/radar/lib/firecrawl";
import { bestUrl, composeSummary, findSources, writeBrief } from "@/features/research/research";
import type { NewPostInput } from "./new-post";
import { pickableReflections } from "@/features/reflections/lessons";
import { listAnswered } from "@/features/reflections/queries";
import { requireOwner } from "@/lib/auth";
import { defaultPostType, weekOf } from "@/lib/week";
import { getRadarShortlist, startPost } from "./queries";
import { pickQuickSource } from "./quick";

export type QuickPostState = { error?: string; postId?: string };

export async function quickPost(): Promise<QuickPostState> {
  await requireOwner();
  const [radar, answered] = await Promise.all([getRadarShortlist(1), listAnswered()]);
  const input = pickQuickSource({
    lessonsWeek: defaultPostType(weekOf()) === "lessons",
    radar,
    reflections: pickableReflections(answered),
  });
  if (!input) return { error: "Nothing to write about yet. Refresh the radar or answer a reflection." };
  return writeWholePost(input);
}

export async function topicPost(_prev: QuickPostState, formData: FormData): Promise<QuickPostState> {
  await requireOwner();
  const parsed = z.string().trim().min(3).max(200).safeParse(formData.get("topic"));
  if (!parsed.success) return { error: "Type a topic of 3-200 characters." };
  const topic = parsed.data;

  let itemId: string;
  try {
    const pages = await findSources(topic, getFirecrawl());
    if (!pages.length) return { error: "Couldn't find good sources for that topic. Try different words." };
    const db = getDb();
    const [owner] = await db.select({ stack: profile.stack }).from(profile).limit(1);
    const brief = await writeBrief(topic, pages, owner?.stack ?? []);
    const [run] = await db
      .insert(radarRuns)
      .values({ status: "done", topic, finishedAt: new Date() })
      .returning({ id: radarRuns.id });
    const item = {
      runId: run.id,
      title: brief.title,
      summary: composeSummary(brief, pages),
      whyItMatters: brief.whyItMatters,
      suggestedType: brief.suggestedType,
      score: 1,
    };
    const url = bestUrl(brief, pages);
    // radar_items.url is unique; a page already seen gets a harmless fragment.
    const [row] =
      (await db.insert(radarItems).values({ ...item, url }).onConflictDoNothing().returning({ id: radarItems.id })) ?? [];
    itemId =
      row?.id ??
      (await db.insert(radarItems).values({ ...item, url: `${url}#topic-${Date.now()}` }).returning({ id: radarItems.id }))[0].id;
  } catch (err) {
    console.error("topicPost research failed", err);
    return { error: "Research failed. Check the Firecrawl key and try again." };
  }
  return writeWholePost({ source: { kind: "radar", id: itemId } });
}

async function writeWholePost(input: NewPostInput): Promise<QuickPostState> {
  const started = await startPost(input);
  if ("error" in started) return { error: started.error };
  const postId = started.postId;

  try {
    const db = getDb();
    const [post] = await db.select({ type: posts.type }).from(posts).where(eq(posts.id, postId));
    if (input.source.kind === "reflection") {
      // The reflection answer is the owner's own words: use it as the interview answer.
      const [r] = await db.select().from(reflections).where(eq(reflections.id, input.source.id));
      if (r?.answer) await db.insert(interviewQas).values({ postId, order: 0, question: r.question, answer: r.answer });
    }
    await Promise.all([
      post.type === "lessons" ? null : proposeDiagram(postId, post.type === "explain"),
      draftAllPlatforms(postId),
    ]);
  } catch (err) {
    console.error("writeWholePost failed", err);
    return { error: "The post was created but writing it failed. Open it and try again.", postId };
  }
  redirect(`/posts/${postId}/drafts`);
}
