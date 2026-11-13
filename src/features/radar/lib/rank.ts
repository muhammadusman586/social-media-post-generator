import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { profile } from "@/db/schema";
import type { Candidate } from "./candidates";

export type Profile = Pick<typeof profile.$inferSelect, "bio" | "stack" | "projects" | "topics" | "avoidTopics">;

export const MAX_SHORTLIST = 5;
/** Candidates sent to the ranking call, to bound prompt size. */
export const MAX_CANDIDATES = 80;
const PAGE_CHARS = 6000;

export const rankingSchema = z.object({
  picks: z.array(
    z.object({
      index: z.number().int().describe("The [n] number of the candidate"),
      title: z.string(),
      summary: z.string().describe("2-3 factual sentences, only from the candidate's text"),
      whyItMatters: z.string().describe("One line to the owner on why this matters for their work"),
      suggestedType: z.enum(["explain", "tried"]),
      score: z.number().describe("0 to 1, fit with the owner's profile"),
    }),
  ),
});
export type RankingOutput = z.infer<typeof rankingSchema>;

export type ShortlistItem = Omit<RankingOutput["picks"][number], "index"> & { url: string; sourceId: string };

/**
 * Turns the model's picks into the shortlist: drops out-of-range and repeated indexes,
 * sorts by score, keeps at most MAX_SHORTLIST, and takes url/source from the candidate
 * (never from the model).
 */
export function toShortlist(output: RankingOutput, candidates: Candidate[]): ShortlistItem[] {
  const used = new Set<number>();
  return output.picks
    .filter((p) => p.index >= 0 && p.index < candidates.length && !used.has(p.index) && used.add(p.index))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SHORTLIST)
    .map(({ index, ...p }) => ({
      ...p,
      title: p.title.trim() || candidates[index].title,
      score: Math.min(1, Math.max(0, p.score)),
      url: candidates[index].url,
      sourceId: candidates[index].sourceId,
    }));
}

const STYLE = `Write plain, specific English. No hype, no marketing words (game changer, revolutionary,
leverage, delve, robust, cutting-edge, unlock, supercharge), no em dashes, no exclamation marks.
Do not invent facts, numbers or claims that are not in the given text.`;

function profileText(p: Profile | undefined) {
  if (!p) return "No profile yet. Prefer practical AI engineering and web development topics.";
  return [
    p.bio && `Bio: ${p.bio}`,
    p.stack.length && `Stack: ${p.stack.join(", ")}`,
    p.projects && `Projects: ${p.projects}`,
    p.topics.length && `Topics they care about: ${p.topics.join(", ")}`,
    p.avoidTopics.length && `Topics to avoid: ${p.avoidTopics.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function rankCandidates(
  candidates: Candidate[],
  owner: Profile | undefined,
  model: LanguageModel,
): Promise<ShortlistItem[]> {
  const list = candidates.slice(0, MAX_CANDIDATES);
  const { output } = await generateText({
    model,
    output: Output.object({ schema: rankingSchema }),
    instructions: `You pick what a software engineer should write about this week on LinkedIn and X.
Pick the 3 to 5 candidates that best fit the owner's profile: new releases or tools they could try
in their stack, or concepts they could explain simply. Skip anything in their avoid list, pure
funding/business news, and near-duplicates of each other.
For each pick:
- title: a short, plain title for the item.
- summary: 2-3 sentences on what it is, using only the candidate's own text.
- whyItMatters: one line to the owner ("you"), naming the specific part of their stack or work it touches and what they would do or see differently (e.g. "Your Trigger.dev tasks could call OpenAI without a stored key"). Don't start with "You could"; no generic "try it in your workflow".
- suggestedType: "tried" for a new release, tool or library they can try hands-on; "explain" for a concept, technique or idea.
- score: 0 to 1, how good a fit it is.
${STYLE}`,
    prompt: `Owner profile:\n${profileText(owner)}\n\nCandidates:\n${list
      .map((c, i) => `[${i}] ${c.title}\n${c.url}\n${c.snippet}`)
      .join("\n\n")}`,
  });
  return toShortlist(output, list);
}

const summariesSchema = z.object({ summaries: z.array(z.object({ index: z.number().int(), summary: z.string() })) });

export async function summarizePages(
  pages: { index: number; title: string; markdown: string }[],
  model: LanguageModel,
): Promise<Map<number, string>> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: summariesSchema }),
    instructions: `Summarize each page in 2-3 factual sentences: what it is and what changed or what it
explains. Use only the page text. ${STYLE}`,
    prompt: pages.map((p) => `[${p.index}] ${p.title}\n${p.markdown.slice(0, PAGE_CHARS)}`).join("\n\n---\n\n"),
  });
  const valid = new Set(pages.map((p) => p.index));
  return new Map(output.summaries.filter((s) => valid.has(s.index) && s.summary.trim()).map((s) => [s.index, s.summary.trim()]));
}
