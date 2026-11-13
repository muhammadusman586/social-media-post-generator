"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { interviewQas, posts, reflections } from "@/db/schema";
import { proposeDiagram } from "@/features/diagrams/actions";
import { draftAllPlatforms } from "@/features/drafts/generate-all";
import { pickableReflections } from "@/features/reflections/lessons";
import { listAnswered } from "@/features/reflections/queries";
import { requireOwner } from "@/lib/auth";
import { defaultPostType, weekOf } from "@/lib/week";
import { getRadarShortlist, startPost } from "./queries";
import { pickQuickSource } from "./quick";

export type QuickPostState = { error?: string; postId?: string };

/** One tap: pick a topic, create the post, write all drafts + the diagram, open the drafts page. */
export async function quickPost(): Promise<QuickPostState> {
  await requireOwner();
  const [radar, answered] = await Promise.all([getRadarShortlist(1), listAnswered()]);
  const input = pickQuickSource({
    lessonsWeek: defaultPostType(weekOf()) === "lessons",
    radar,
    reflections: pickableReflections(answered),
  });
  if (!input) return { error: "Nothing to write about yet. Refresh the radar or answer a reflection." };

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
    console.error("quickPost failed", err);
    return { error: "The post was created but writing it failed. Open it and try again.", postId };
  }
  redirect(`/posts/${postId}/drafts`);
}
