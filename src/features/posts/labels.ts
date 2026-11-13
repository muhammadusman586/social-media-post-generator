import type { PostStatus, PostType } from "@/db/schema";

export const TYPE_LABEL: Record<PostType, string> = {
  explain: "Explain it simply",
  tried: "I tried it",
  lessons: "2-year lessons",
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Not started",
  interview: "Interview",
  drafted: "Drafts",
  posted: "Posted",
};

/** "2026-11-09" -> "Nov 9" */
export function formatWeek(weekOf: string): string {
  return new Date(`${weekOf}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
