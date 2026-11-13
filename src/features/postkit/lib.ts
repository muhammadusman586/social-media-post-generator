import type { Platform } from "@/db/schema";

export const X_LIMIT = 280;

// twitter-text v3 weights: these code point ranges count 1, everything else counts 2.
const LIGHT_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const URL_RE = /https?:\/\/\S+?(?=[.,!?;:)\]'"]*(?:\s|$))/gu;
const URL_WEIGHT = 23;

/**
 * Character count as X shows it: http(s) URLs count 23, emoji 2, CJK 2, Latin 1.
 * shortcut: bare domains ("example.com") count as plain text, X would count 23.
 */
export function xLength(text: string): number {
  let urls = 0;
  const rest = text.normalize("NFC").replace(URL_RE, () => {
    urls++;
    return "";
  });
  let len = urls * URL_WEIGHT;
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(rest)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) {
      len += 2;
      continue;
    }
    for (const ch of segment) {
      const cp = ch.codePointAt(0)!;
      len += LIGHT_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
    }
  }
  return len;
}

export function formatThread(posts: string[]): string[] {
  const clean = posts.map((p) => p.trim()).filter(Boolean);
  const n = clean.length;
  if (n <= 1) return clean;
  return clean.map((p, i) => {
    const marker = new RegExp(`(^|\\s)${i + 1}\\s*/\\s*${n}(\\s|$)`);
    return marker.test(p) ? p : `${p}\n\n${i + 1}/${n}`;
  });
}

type DraftLike = { platform: Platform; version: number; isFinal: boolean; postedAt: Date | null };

export function latestFinals<T extends DraftLike>(drafts: T[]): Partial<Record<Platform, T>> {
  const out: Partial<Record<Platform, T>> = {};
  for (const d of drafts) {
    if (!d.isFinal) continue;
    const cur = out[d.platform];
    if (!cur || d.version > cur.version) out[d.platform] = d;
  }
  return out;
}

export function allPosted(finals: Partial<Record<Platform, DraftLike>>): boolean {
  const list = Object.values(finals);
  return list.length > 0 && list.every((d) => d?.postedAt);
}

export type KitImage = { url: string; name: string };

/**
 * Images offered per platform. Instagram gets the slides. LinkedIn gets the slides (as a
 * carousel) or else the diagram. X gets the diagram or else up to 4 slides (X's limit).
 */
export function imagesFor(platform: Platform, slides: KitImage[], diagram: KitImage | null): KitImage[] {
  if (platform === "instagram") return slides;
  if (platform === "linkedin") return slides.length ? slides : diagram ? [diagram] : [];
  return diagram ? [diagram] : slides.slice(0, 4);
}

type ShareNav = { canShare?: (data: { files: File[] }) => boolean };

/** "share" when the browser can share these files (iOS Safari 15+), else "download". */
export function shareMode(nav: ShareNav | undefined, files: File[]): "share" | "download" {
  if (!files.length || typeof nav?.canShare !== "function") return "download";
  try {
    return nav.canShare({ files }) ? "share" : "download";
  } catch {
    return "download";
  }
}

export const OPEN_APP: Record<Platform, { label: string; url: string }> = {
  // https universal links: iOS opens the installed app, else the website.
  linkedin: { label: "Open LinkedIn", url: "https://www.linkedin.com/feed/?shareActive=true" },
  x: { label: "Open X", url: "https://x.com/compose/post" },
  instagram: { label: "Open Instagram", url: "https://www.instagram.com/" },
};
