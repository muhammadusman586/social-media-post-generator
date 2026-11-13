import type { PostType } from "@/db/schema";

type Reflection = { answer: string | null; used: boolean };

/** Show the "Write a lessons post" entry on a lessons week that has no post yet. */
export function showLessonsEntry(weekType: PostType, hasPostThisWeek: boolean): boolean {
  return weekType === "lessons" && !hasPostThisWeek;
}

/** Reflections a lessons post can start from: answered and not used by another post. */
export function pickableReflections<R extends Reflection>(rows: R[]): R[] {
  return rows.filter((r) => Boolean(r.answer?.trim()) && !r.used);
}
