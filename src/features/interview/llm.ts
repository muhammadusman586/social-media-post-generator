import { generateText, Output } from "ai";
import { z } from "zod";
import type { PostType } from "@/db/schema";
import { getModel } from "@/lib/ai";

export type QuestionSource = {
  type: PostType;
  item: { title: string; url: string; summary: string; whyItMatters: string } | null;
  reflection: { question: string; answer: string | null } | null;
};

const QUESTION_GOALS: Record<PostType, string> = {
  explain:
    'Get the owner\'s own explanation and real context. Examples: "How would you explain this to a junior?", "Where have you seen it used or used it yourself?"',
  tried:
    'Get what the owner did, or plans to do if they have not tried it yet. Examples: "Have you tried it yet? If yes, what did you build?", "What worked or broke?", "If not yet, what would you try it on first?"',
  lessons:
    'Get one concrete situation from the owner\'s work behind the reflection: what happened, what they did, what changed after. Remind them to leave out client names.',
};

function describeSource({ item, reflection }: QuestionSource): string {
  if (item) return `Topic: ${item.title}\nURL: ${item.url}\nSummary: ${item.summary}\nWhy it matters to the owner: ${item.whyItMatters}`;
  if (reflection) return `Reflection question: ${reflection.question}\nOwner's answer so far: ${reflection.answer ?? "(none)"}`;
  return "(no source)";
}

/** 2-3 short interview questions for the post. */
export async function writeQuestions(src: QuestionSource): Promise<string[]> {
  const { output } = await generateText({
    model: getModel(),
    instructions: `You interview a software engineer so a weekly post contains their own experience and opinion, not generic content.
Write 2 or 3 short questions (one sentence each) they can answer by voice on a phone. Ask about specifics: what they did, saw, measured, got wrong. No yes/no questions, no compound questions.
${QUESTION_GOALS[src.type]}`,
    prompt: describeSource(src),
    output: Output.object({ schema: z.object({ questions: z.array(z.string()) }) }),
  });
  return output.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3);
}

/** A short illustrative code snippet for an explain post with no diagram. */
export async function writeExample(src: QuestionSource, answers: string[]): Promise<{ code: string; language: string }> {
  const { output } = await generateText({
    model: getModel(),
    instructions:
      "Write one short, correct, illustrative code snippet (at most 25 lines) that shows the concept in practice. Use TypeScript unless another language clearly fits better. No comments that narrate the obvious. It will be labelled as an AI-written example.",
    prompt: `${describeSource(src)}\n\nThe owner's notes:\n${answers.join("\n\n") || "(none)"}`,
    output: Output.object({ schema: z.object({ code: z.string(), language: z.string() }) }),
  });
  return { code: output.code.trim(), language: output.language };
}

/** Lessons proof: do the answers describe a concrete, real situation from the owner's work? */
export async function checkRealSituation(answers: { question: string; answer: string }[]): Promise<{ ok: boolean; reason: string }> {
  const { output } = await generateText({
    model: getModel(),
    instructions:
      'Decide if these interview answers describe at least one concrete, real situation from the person\'s own work (what happened, when or where, what they did). General advice or opinions alone do not count. Give a one-sentence reason; when it fails, say what detail to add.',
    prompt: answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n") || "(no answers)",
    output: Output.object({ schema: z.object({ ok: z.boolean(), reason: z.string() }) }),
  });
  return output;
}
