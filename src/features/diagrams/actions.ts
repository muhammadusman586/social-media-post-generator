"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { requireOwner } from "@/lib/auth";
import { proposeDiagramSpec } from "./generate";
import { getDiagramPageData, saveDiagramSnapshot, upsertDiagramSpec } from "./queries";

const postIdSchema = z.uuid();

export type ProposeResult = { ok: true; useful: boolean; reason: string } | { ok: false; error: string };

/**
 * Asks the model whether a diagram helps this post. When it does (or `force` is set),
 * saves the spec and clears any old canvas so the editor draws it fresh.
 */
export async function proposeDiagram(postId: string, force: boolean): Promise<ProposeResult> {
  await requireOwner();
  const id = postIdSchema.parse(postId);
  const post = await getDiagramPageData(id);
  if (!post) return { ok: false, error: "Post not found." };

  try {
    const proposal = await proposeDiagramSpec(
      {
        postType: post.type,
        title: post.title,
        item: post.radarItem,
        reflection: post.reflection,
        answers: post.interviewQas,
      },
      { force, model: getModel() },
    );
    if (proposal.spec) {
      await upsertDiagramSpec(id, proposal.spec);
      revalidatePath(`/posts/${id}/diagram`);
    }
    return { ok: true, useful: proposal.useful, reason: proposal.reason };
  } catch (err) {
    console.error("proposeDiagram failed", err);
    return { ok: false, error: "Couldn't get a diagram from the model. Try again." };
  }
}

export async function saveSnapshot(postId: string, snapshot: unknown): Promise<void> {
  await requireOwner();
  if (typeof snapshot !== "object" || snapshot === null) throw new Error("Bad snapshot");
  await saveDiagramSnapshot(postIdSchema.parse(postId), snapshot);
}
