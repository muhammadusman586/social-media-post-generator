import type { sources } from "@/db/schema";
import type { FirecrawlLike } from "./firecrawl";

export type Source = typeof sources.$inferSelect;
export type Candidate = { url: string; title: string; snippet: string; sourceId: string };

export const SOURCE_KINDS: { value: Source["kind"]; label: string }[] = [
  { value: "blog", label: "Blog" },
  { value: "changelog", label: "Changelog" },
  { value: "search", label: "Web search" },
  { value: "hn", label: "Hacker News" },
  { value: "github_trending", label: "GitHub trending" },
];

/** Newest links kept per source. Listing pages put the newest first. */
export const PER_SOURCE = 8;
const SNIPPET_CHARS = 280;

/** Drops the hash, utm_* params and a trailing slash so the same page always has one URL. */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (key.startsWith("utm_")) u.searchParams.delete(key);
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString().replace(/\/$/, ""); // root path "/" survives the line above
  } catch {
    return null;
  }
}

const host = (u: URL) => u.hostname.replace(/^www\./, "");

// First path segments on github.com that are not repo owners.
const GITHUB_RESERVED = new Set([
  "about", "apps", "collections", "contact", "enterprise", "explore", "features", "login",
  "marketplace", "orgs", "pricing", "settings", "signup", "site", "sponsors", "topics", "trending",
]);

/** Which links on a listing page are posts/releases/stories, by source kind. */
function keepLink(kind: Source["kind"], link: URL, listing: URL, strict: boolean): boolean {
  const parts = link.pathname.split("/").filter(Boolean);
  switch (kind) {
    case "hn": // stories point off-site; everything on HN itself is chrome or comments
      return host(link) !== host(listing);
    case "github_trending": // repos are github.com/<owner>/<repo>
      return host(link) === "github.com" && parts.length === 2 && !GITHUB_RESERVED.has(parts[0]);
    default: {
      // blog / changelog: same site, below the listing path (strict), or any page 2+ levels deep
      if (host(link) !== host(listing) || link.pathname.replace(/\/$/, "") === listing.pathname.replace(/\/$/, ""))
        return false;
      const prefix = listing.pathname.replace(/\/$/, "") + "/";
      return strict ? link.pathname.startsWith(prefix) : parts.length >= 2;
    }
  }
}

const stripMarkdown = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Pulls [title](url) links from a scraped listing page, with nearby text as the snippet. */
export function linksFromListing(markdown: string, source: Source): Candidate[] {
  if (!source.url) return [];
  const listing = new URL(source.url);
  const lines = markdown.split("\n");
  const found: { url: string; title: string; snippet: string; line: number }[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)) {
      const title = stripMarkdown(m[1]);
      const url = normalizeUrl(m[2], source.url!);
      if (!url || title.length < 4) continue;
      const snippet = stripMarkdown(lines.slice(i, i + 3).join(" ")).slice(0, SNIPPET_CHARS);
      found.push({ url, title, snippet, line: i });
    }
  });

  const pick = (strict: boolean) => found.filter((f) => keepLink(source.kind, new URL(f.url), listing, strict));
  let kept = pick(true);
  if (!kept.length && (source.kind === "blog" || source.kind === "changelog")) kept = pick(false);

  const seen = new Set<string>();
  return kept
    .filter((f) => !seen.has(f.url) && seen.add(f.url))
    .slice(0, PER_SOURCE)
    .map(({ url, title, snippet }) => ({ url, title, snippet, sourceId: source.id }));
}

/** Candidates from one source: Firecrawl search for 'search', a listing-page scrape for the rest. */
export async function candidatesFromSource(source: Source, firecrawl: FirecrawlLike): Promise<Candidate[]> {
  if (source.kind === "search") {
    if (!source.query) return [];
    const data = await firecrawl.search(source.query, { limit: PER_SOURCE, tbs: "qdr:w" });
    return (data.web ?? []).flatMap((r) => {
      // Without scrapeOptions the API returns plain web results (url/title/description).
      const url = "url" in r && typeof r.url === "string" ? normalizeUrl(r.url) : null;
      const title = "title" in r && typeof r.title === "string" ? r.title : "";
      const snippet = "description" in r && typeof r.description === "string" ? r.description : "";
      return url && title ? [{ url, title, snippet: snippet.slice(0, SNIPPET_CHARS), sourceId: source.id }] : [];
    });
  }
  if (!source.url) return [];
  const doc = await firecrawl.scrape(source.url, {
    formats: ["markdown"],
    // HN and GitHub trending are tables of links; "main content" detection can drop them.
    onlyMainContent: source.kind !== "hn" && source.kind !== "github_trending",
  });
  return linksFromListing(doc.markdown ?? "", source);
}

/**
 * Candidates from every enabled source, deduped by URL and minus URLs already in radar_items.
 * A failing source is logged and skipped so one dead page does not sink the run.
 */
export async function collectCandidates(
  all: Source[],
  firecrawl: FirecrawlLike,
  knownUrls: Set<string>,
): Promise<Candidate[]> {
  const enabled = all.filter((s) => s.enabled);
  const results = await Promise.allSettled(enabled.map((s) => candidatesFromSource(s, firecrawl)));
  const seen = new Set(knownUrls);
  const out: Candidate[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`radar: source "${enabled[i].name}" failed:`, r.reason);
      return;
    }
    for (const c of r.value) {
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      out.push(c);
    }
  });
  return out;
}
