"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { platform as platformEnum, type DraftContent, type Platform, type SlideContent } from "@/db/schema";
import { checkRealSituation } from "@/features/interview/llm";
import { draftBlocker, finalizeBlockers } from "@/features/interview/proof";
import { replaceFlags } from "@/features/slop/queries";
import { reviewDrafts } from "@/features/slop/review";
import { requireOwner } from "@/lib/auth";
import { generateDraft, type SlideKind } from "./generate";
import { draftAllPlatforms, storeDraft } from "./generate-all";
import type { DraftContext } from "./prompt";
import {
  finalizeDrafts,
  getDraftContext,
  getLatestDrafts,
  getSlides,
} from "./queries";
import { draftText } from "./text";

const id = z.uuid();
const platformSchema = z.enum(platformEnum.enumValues);
const str = (max: number) => z.string().max(max).optional();
const contentSchema = z.object({ text: str(10_000), posts: z.array(z.string().max(2_000)).max(10).optional(), caption: str(5_000) });
const slidesSchema = z
  .array(
    z.object({
      kind: z.enum(["title", "text", "diagram", "code", "quote"]),
      content: z.object({ heading: str(500), body: str(2_000), code: str(5_000), language: str(40), quote: str(1_000), imageUrl: str(2_000) }),
    }),
  )
  .max(10);

type Result = { error?: string };

async function loadContext(postId: string) {
  const data = await getDraftContext(id.parse(postId));
  if (!data) throw new Error("Post not found");
  return data;
}

const store = storeDraft;

/** First generation: all three platforms in parallel. Answers are optional (drafts from the source alone). */
export async function generateDrafts(postId: string): Promise<Result> {
  await requireOwner();
  const { post, ctx } = await loadContext(postId);
  const blocked = draftBlocker({ ...ctx, type: post.type });
  if (blocked) return { error: blocked };

  await draftAllPlatforms(post.id);
  refresh();
  return {};
}

export async function regenerateDraft(postId: string, platform: Platform, instruction: string): Promise<Result> {
  await requireOwner();
  const { post, ctx } = await loadContext(postId);
  const p = platformSchema.parse(platform);
  const blocked = draftBlocker({ ...ctx, type: post.type });
  if (blocked) return { error: blocked };
  const previous = (await getLatestDrafts(post.id)).get(p);
  const draft = await generateDraft(ctx, p, {
    instruction: z.string().max(500).parse(instruction),
    previous: previous && draftText(previous.content),
  });
  await store(ctx, post.id, p, draft);
  refresh();
  return {};
}

/** Inline edit: saves a new version (and the Instagram slides). */
export async function saveDraft(
  postId: string,
  platform: Platform,
  content: DraftContent,
  slides?: { kind: SlideKind; content: SlideContent }[],
): Promise<Result> {
  await requireOwner();
  const { post, ctx } = await loadContext(postId);
  const p = platformSchema.parse(platform);
  await store(ctx, post.id, p, {
    content: contentSchema.parse(content),
    slides: p === "instagram" && slides ? slidesSchema.parse(slides) : undefined,
  });
  refresh();
  return {};
}

/** LLM slop review of the latest drafts; replaces earlier LLM flags. Warnings only. */
async function review(ctx: DraftContext, postId: string) {
  const latest = await getLatestDrafts(postId);
  const slides = (await getSlides(postId)).map((s) => s.content);
  const drafts = [...latest.values()];
  if (!drafts.length) return;

  const flags = await reviewDrafts({
    answers: ctx.qas.flatMap((q) => (q.answer?.trim() ? [{ question: q.question, answer: q.answer }] : [])),
    source: ctx.item
      ? `${ctx.item.title}\n${ctx.item.summary}`
      : ctx.reflection
        ? `${ctx.reflection.question}\n${ctx.reflection.answer ?? ""}`
        : "(none)",
    exampleCode: ctx.uploads.flatMap((u) => (u.isGenerated && u.approvedAt && u.codeText ? [u.codeText] : [])),
    proofNote:
      [
        ctx.uploads.some((u) => u.kind === "image" && !u.isGenerated) && "owner's screenshot",
        ctx.uploads.some((u) => u.kind === "code" && !u.isGenerated) && "owner's code",
        ctx.hasDiagram && "diagram",
      ]
        .filter(Boolean)
        .join(", ") || "(none)",
    drafts: drafts.map((d) => ({ platform: d.platform, text: draftText(d.content, d.platform === "instagram" ? slides : []) })),
  });

  await replaceFlags(
    "llm",
    drafts.map((d) => ({
      draftId: d.id,
      flags: flags.filter((f) => f.platform === d.platform).map(({ rule, quote, suggestion }) => ({ rule, quote, suggestion })),
    })),
  );
}

export async function reviewWithAi(postId: string): Promise<Result> {
  await requireOwner();
  const { post, ctx } = await loadContext(postId);
  await review(ctx, post.id);
  refresh();
  return {};
}

/** Blocks on missing proof or [ADD: …] placeholders; runs the LLM review once; marks finals. */
export async function finalizePost(postId: string): Promise<{ blockers?: string[] }> {
  await requireOwner();
  const { post, ctx } = await loadContext(postId);
  const latest = await getLatestDrafts(post.id);
  if (latest.size < platformEnum.enumValues.length) return { blockers: ["Write drafts for all three platforms first."] };
  const slides = (await getSlides(post.id)).map((s) => s.content);
  const drafts = [...latest.values()];

  const realSituation =
    post.type === "lessons"
      ? await checkRealSituation(ctx.qas.flatMap((q) => (q.answer?.trim() ? [{ question: q.question, answer: q.answer }] : [])))
      : undefined;
  const blockers = finalizeBlockers({
    ...ctx,
    type: post.type,
    realSituation,
    draftTexts: drafts.map((d) => draftText(d.content, d.platform === "instagram" ? slides : [])),
  });
  if (blockers.length) return { blockers };

  // The review only adds warnings; an LLM outage must not stop the owner from finishing.
  await review(ctx, post.id).catch((e) => console.error("slop review failed", e));
  await finalizeDrafts(
    post.id,
    drafts.map((d) => ({ id: d.id, platform: d.platform, text: draftText(d.content) })),
  );
  refresh();
  return {};
}
