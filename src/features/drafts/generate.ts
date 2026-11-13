import { generateText, Output } from "ai";
import { z } from "zod";
import type { DraftContent, Platform, SlideContent } from "@/db/schema";
import { getModel } from "@/lib/ai";
import { buildDraftPrompt, type DraftContext } from "./prompt";
import { stripNumbering } from "./x";

export type SlideKind = "title" | "text" | "diagram" | "code" | "quote";
export type GeneratedDraft = { content: DraftContent; slides?: { kind: SlideKind; content: SlideContent }[] };

// OpenAI strict structured output: every field required, so optional ones are nullable.
const slideSchema = z.object({
  kind: z.enum(["title", "text", "diagram", "code", "quote"]),
  heading: z.string().nullable(),
  body: z.string().nullable(),
  code: z.string().nullable(),
  language: z.string().nullable(),
  quote: z.string().nullable(),
});

const SCHEMAS = {
  linkedin: z.object({ text: z.string() }),
  x: z.object({ posts: z.array(z.string()) }),
  instagram: z.object({ caption: z.string(), slides: z.array(slideSchema) }),
};

/** One structured-output call for one platform. */
export async function generateDraft(
  ctx: DraftContext,
  platform: Platform,
  opts: { instruction?: string; previous?: string } = {},
): Promise<GeneratedDraft> {
  const { instructions, prompt } = buildDraftPrompt(ctx, platform, opts);
  const { output } = await generateText({
    model: getModel(),
    instructions,
    prompt,
    output: Output.object({ schema: SCHEMAS[platform] }),
  });

  if ("text" in output) return { content: { text: output.text.trim() } };
  if ("posts" in output) return { content: { posts: output.posts.map(stripNumbering).filter(Boolean) } };

  const slides = output.slides
    .filter((s) => ctx.post.type !== "lessons" || s.kind === "quote")
    .slice(0, ctx.post.type === "lessons" ? 1 : 7)
    .map(({ kind, ...fields }) => ({
      kind,
      content: Object.fromEntries(
        Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim()),
      ) as SlideContent,
    }));
  return { content: { caption: output.caption.trim() }, slides };
}
