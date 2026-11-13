import { generateText, Output, type LanguageModel } from "ai";
import type { DiagramSpec, PostType } from "@/db/schema";
import { normalizeSpec, proposalSchema, MAX_NODES } from "./spec";

/** Everything the model may draw from. Nothing else. */
export type DiagramSource = {
  postType: PostType;
  title: string;
  item: { title: string; url: string; summary: string; whyItMatters: string } | null;
  reflection: { question: string; answer: string | null } | null;
  answers: { question: string; answer: string | null }[];
};

export type DiagramProposal = { useful: boolean; reason: string; spec: DiagramSpec | null };

const SYSTEM = `You decide whether a diagram helps a short social post, and if so you design it.
Rules:
- Use only facts in the material below. Do not add tools, steps, numbers or components that are not there.
- Box labels: 2-5 words, wording taken from the material. Edge labels: 1-3 words or null.
- At most ${MAX_NODES} boxes. Groups only when the material names distinct parts (e.g. client vs server).
- A diagram is useful when the post explains a flow, an architecture, or how parts relate. Opinions, stories and single facts don't need one.
- reason: one plain sentence, no hype.`;

export function buildPrompt(src: DiagramSource, force: boolean): string {
  const parts = [`Post type: ${src.postType}`, `Post title: ${src.title || "(none)"}`];
  if (src.item) {
    parts.push(
      `Radar item: ${src.item.title}\nURL: ${src.item.url}\nSummary: ${src.item.summary}\nWhy it matters: ${src.item.whyItMatters}`,
    );
  }
  if (src.reflection) parts.push(`Reflection: ${src.reflection.question}\nAnswer: ${src.reflection.answer ?? ""}`);
  const answered = src.answers.filter((a) => a.answer?.trim());
  if (answered.length) parts.push(`Interview:\n${answered.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n")}`);
  parts.push(
    force
      ? "The owner wants a diagram anyway: set useful to true and return the best diagram the material supports."
      : "If a diagram would not help, set useful to false and diagram to null.",
  );
  return parts.join("\n\n");
}

/** Asks the model for a diagram. `model` is injectable for tests; callers pass getModel(). */
export async function proposeDiagramSpec(
  src: DiagramSource,
  { force, model }: { force: boolean; model: LanguageModel },
): Promise<DiagramProposal> {
  const { output } = await generateText({
    model,
    system: SYSTEM,
    prompt: buildPrompt(src, force),
    output: Output.object({ schema: proposalSchema }),
  });
  if ((!output.useful && !force) || !output.diagram) {
    return { useful: false, reason: output.reason, spec: null };
  }
  return { useful: true, reason: output.reason, spec: normalizeSpec(output.diagram) };
}
