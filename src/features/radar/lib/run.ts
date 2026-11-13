import type { LanguageModel } from "ai";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getModel } from "@/lib/ai";
import { collectCandidates, type Source } from "./candidates";
import { getFirecrawl, type FirecrawlLike } from "./firecrawl";
import { rankCandidates, summarizePages, type Profile, type ShortlistItem } from "./rank";

/**
 * The Radar pipeline without the DB: collect candidates from snippets/listings, rank them
 * in one LLM call, then scrape full pages for the shortlist only (cost rule, requirements §8a)
 * and rewrite those summaries from the page text.
 */
export async function buildShortlist(input: {
  sources: Source[];
  profile: Profile | undefined;
  knownUrls: Set<string>;
  firecrawl: FirecrawlLike;
  model: LanguageModel;
}): Promise<ShortlistItem[]> {
  const candidates = await collectCandidates(input.sources, input.firecrawl, input.knownUrls);
  if (!candidates.length) return [];
  const shortlist = await rankCandidates(candidates, input.profile, input.model);
  if (!shortlist.length) return [];

  const scraped = await Promise.allSettled(
    shortlist.map((item) => input.firecrawl.scrape(item.url, { formats: ["markdown"], onlyMainContent: true })),
  );
  const pages = scraped.flatMap((r, index) =>
    r.status === "fulfilled" && r.value.markdown?.trim()
      ? [{ index, title: shortlist[index].title, markdown: r.value.markdown }]
      : [],
  );
  if (!pages.length) return shortlist;
  const summaries = await summarizePages(pages, input.model);
  return shortlist.map((item, i) => ({ ...item, summary: summaries.get(i) ?? item.summary }));
}

export async function runRadar({ triggerRunId }: { triggerRunId?: string } = {}) {
  const db = getDb();
  const [run] = await db.insert(schema.radarRuns).values({ triggerRunId }).returning({ id: schema.radarRuns.id });
  try {
    const [sources, [owner], known] = await Promise.all([
      db.select().from(schema.sources),
      db.select().from(schema.profile).orderBy(desc(schema.profile.createdAt)).limit(1),
      db.select({ url: schema.radarItems.url }).from(schema.radarItems),
    ]);
    const items = await buildShortlist({
      sources,
      profile: owner,
      knownUrls: new Set(known.map((k) => k.url)),
      firecrawl: getFirecrawl(),
      model: getModel(),
    });
    if (items.length) {
      await db
        .insert(schema.radarItems)
        .values(items.map((item) => ({ ...item, runId: run.id })))
        .onConflictDoNothing({ target: schema.radarItems.url });
    }
    await db
      .update(schema.radarRuns)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(schema.radarRuns.id, run.id));
    return { runId: run.id, items: items.length };
  } catch (err) {
    await db
      .update(schema.radarRuns)
      .set({ status: "failed", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() })
      .where(eq(schema.radarRuns.id, run.id));
    throw err;
  }
}
