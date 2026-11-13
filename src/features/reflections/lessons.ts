import type { PostType } from "@/db/schema";

type Reflection = { answer: string | null; used: boolean };

export function showLessonsEntry(weekType: PostType, hasPostThisWeek: boolean): boolean {
  return weekType === "lessons" && !hasPostThisWeek;
}

export function pickableReflections<R extends Reflection>(rows: R[]): R[] {
  return rows.filter((r) => Boolean(r.answer?.trim()) && !r.used);
}
