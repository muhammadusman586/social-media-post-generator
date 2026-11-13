import { generateText, Output } from "ai";
import { z } from "zod";
import type { FirecrawlLike } from "@/features/radar/lib/firecrawl";
import { getModel } from "@/lib/ai";

const MAX_PAGES = 3;
const PAGE_CHARS = 6_000;

export type Page = { url: string; title: string; markdown: string };
export type Brief = {
  title: string;
  summary: string;
  whyItMatters: string;
  suggestedType: "explain" | "tried";
  code: string | null;
  language: string | null;
  bestSource: number;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Firecrawl search with page content; keeps the top pages that have real text. */
export async function findSources(topic: string, firecrawl: FirecrawlLike): Promise<Page[]> {
  const data = await firecrawl.search(topic, {
    limit: 6,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
  });
  const pages: Page[] = [];
  for (const r of data.web ?? []) {
    const rec = r as Record<string, unknown>;
    const meta = (rec.metadata ?? {}) as Record<string, unknown>;
    const url = str(rec.url) || str(meta.sourceURL) || str(meta.url);
    const markdown = str(rec.markdown);
    if (url && markdown.trim().length > 300) {
      pages.push({ url, title: str(rec.title) || str(meta.title) || url, markdown: markdown.slice(0, PAGE_CHARS) });
    }
  }
  return pages.slice(0, MAX_PAGES);
}

const briefSchema = z.object({
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  suggestedType: z.enum(["explain", "tried"]),
  code: z.string().nullable(),
  language: z.string().nullable(),
  bestSource: z.number().int(),
});

/** One LLM call that turns the pages into a factual brief the drafts can use as their SOURCE. */
export async function writeBrief(topic: string, pages: Page[], stack: string[]): Promise<Brief> {
  const { output } = await generateText({
    model: getModel(),
    instructions: [
      "You research a topic for a software engineer's social post. Use only facts from the PAGES. Never invent numbers, features or quotes.",
      "- title: a short plain title for the topic.",
      "- summary: 6-10 plain sentences: what it is, how it works step by step, the key facts and numbers from the pages, and common mistakes if the pages mention them.",
      "- whyItMatters: one line to the engineer (\"you\") on how it touches their stack. No hype, don't start with \"You could\".",
      '- suggestedType: "tried" only if the topic is a specific new tool or release they can try hands-on; otherwise "explain".',
      "- code: when the topic is about code, a short snippet (max 15 lines) copied or closely adapted from the pages that shows the idea; otherwise null. language: its language or null.",
      "- bestSource: index (0-based) of the most useful page.",
    ].join("\n"),
    prompt: [
      `Topic: ${topic}`,
      stack.length ? `Engineer's stack: ${stack.join(", ")}` : "",
      ...pages.map((p, i) => `## PAGE ${i}: ${p.title}\nURL: ${p.url}\n${p.markdown}`),
    ]
      .filter(Boolean)
      .join("\n\n"),
    output: Output.object({ schema: briefSchema }),
  });
  return output;
}

/** The radar-item summary the drafts read: brief + example code + source list. */
export function composeSummary(brief: Pick<Brief, "summary" | "code" | "language">, pages: Page[]): string {
  const parts = [brief.summary.trim()];
  if (brief.code?.trim()) {
    parts.push(`Code example from the sources:\n\`\`\`${brief.language ?? ""}\n${brief.code.trim()}\n\`\`\``);
  }
  parts.push(`Sources:\n${pages.map((p) => `- ${p.title}: ${p.url}`).join("\n")}`);
  return parts.join("\n\n");
}

/** The page the post links to: the model's pick when valid, else the first. */
export function bestUrl(brief: Pick<Brief, "bestSource">, pages: Page[]): string {
  return (pages[brief.bestSource] ?? pages[0]).url;
}
