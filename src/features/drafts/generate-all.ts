import { platform as platformEnum, type Platform, type SlideContent } from "@/db/schema";
import { lintDraft } from "@/features/slop/lint";
import { replaceFlags } from "@/features/slop/queries";
import { generateDraft, type GeneratedDraft } from "./generate";
import type { DraftContext } from "./prompt";
import { getDraftContext, getSlides, insertDraft, markDrafted, replaceSlides } from "./queries";

/** Save a generated or edited draft as a new version, with slides and lint flags. */
export async function storeDraft(ctx: DraftContext, postId: string, platform: Platform, draft: GeneratedDraft) {
  const row = await insertDraft(postId, platform, draft.content);
  let slides: SlideContent[] = [];
  if (platform === "instagram" && draft.slides) {
    await replaceSlides(postId, draft.slides);
    slides = draft.slides.map((s) => s.content);
  } else if (platform === "instagram") {
    slides = (await getSlides(postId)).map((s) => s.content);
  }
  const flags = lintDraft(platform, draft.content, slides, ctx.profile?.neverMention);
  await replaceFlags("lint", [{ draftId: row.id, flags }]);
}

/** Writes LinkedIn, X and Instagram drafts in parallel and marks the post drafted. Caller checks auth. */
export async function draftAllPlatforms(postId: string) {
  const data = await getDraftContext(postId);
  if (!data) throw new Error("Post not found");
  const { post, ctx } = data;
  const platforms = platformEnum.enumValues;
  const results = await Promise.all(platforms.map((p) => generateDraft(ctx, p)));
  for (const [i, p] of platforms.entries()) await storeDraft(ctx, post.id, p, results[i]);
  await markDrafted(post.id);
}
