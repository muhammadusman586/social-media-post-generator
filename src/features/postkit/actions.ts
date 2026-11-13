"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { drafts, posts } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { allPosted } from "./lib";
import { getFinalDrafts } from "./queries";

/** Marks one platform's final draft as posted (or not), then syncs posts.status. */
export async function markPosted(draftId: string, posted: boolean) {
  await requireOwner();
  const id = z.uuid().parse(draftId);
  const db = getDb();

  const [draft] = await db
    .update(drafts)
    .set({ postedAt: posted ? new Date() : null })
    .where(and(eq(drafts.id, id), eq(drafts.isFinal, true)))
    .returning({ postId: drafts.postId });
  if (!draft) throw new Error("Final draft not found");

  const done = allPosted(await getFinalDrafts(draft.postId));
  const [post] = await db.select({ status: posts.status }).from(posts).where(eq(posts.id, draft.postId));
  if (done && post?.status !== "posted") {
    await db.update(posts).set({ status: "posted" }).where(eq(posts.id, draft.postId));
  } else if (!done && post?.status === "posted") {
    await db.update(posts).set({ status: "drafted" }).where(eq(posts.id, draft.postId));
  }

  revalidatePath("/", "layout"); // status shows on home, posts list and overview
}
