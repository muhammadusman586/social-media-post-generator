import { generateText, Output } from "ai";
import { z } from "zod";
import type { Platform } from "@/db/schema";
import { getModel } from "@/lib/ai";
import { STYLE_RULES } from "./rules";

export type ReviewInput = {
  answers: { question: string; answer: string }[];
  source: string;
  /** Approved AI-written example code: illustrative, exempt from the claims check. */
  exampleCode: string[];
  proofNote: string;
  drafts: { platform: Platform; text: string }[];
};

export type ReviewFlag = { platform: Platform; rule: string; quote: string; suggestion: string };

const schema = z.object({
  flags: z.array(
    z.object({
      platform: z.enum(["linkedin", "x", "instagram"]),
      rule: z.string(),
      quote: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export async function reviewDrafts(input: ReviewInput): Promise<ReviewFlag[]> {
  const { output } = await generateText({
    model: getModel(),
    instructions: `You review social posts an engineer is about to publish. Report problems; do not rewrite the posts.
Check each draft for:
1. "No proof": the draft has no concrete proof element (a number, code, a screenshot, a diagram, or a real situation from the owner's work).
2. "Unsupported claim": the draft says the owner did, tried, measured, felt, learned or thinks something that is not in the ANSWERS or SOURCE. Illustrative EXAMPLE CODE is exempt, but claiming the owner wrote or shipped it is not.
3. Any breach of the writing rules below. Use the pattern name as the rule (e.g. "Binary contrast").
For each problem give: platform, rule, the exact quoted line from the draft, and a fix in a few words. Return an empty list when a draft is clean. Do not flag [ADD: ...] placeholders.

${STYLE_RULES}`,
    prompt: [
      `## SOURCE\n${input.source}`,
      `## ANSWERS\n${input.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n") || "(none)"}`,
      `## PROOF ATTACHED\n${input.proofNote}`,
      input.exampleCode.length ? `## EXAMPLE CODE (AI-written, approved)\n${input.exampleCode.join("\n\n")}` : "",
      ...input.drafts.map((d) => `## DRAFT (${d.platform})\n${d.text}`),
    ]
      .filter(Boolean)
      .join("\n\n"),
    output: Output.object({ schema }),
  });
  return output.flags;
}
