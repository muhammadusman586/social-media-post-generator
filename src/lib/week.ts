import type { PostType } from "@/db/schema";

const TZ = "Asia/Karachi";

/** Default rotation by week of month: 1 explain, 2 tried, 3 explain, 4+ lessons. */
export const ROTATION: readonly PostType[] = ["explain", "tried", "explain", "lessons"];

/** Monday (YYYY-MM-DD) of the week containing `now`, in Asia/Karachi. Matches posts.week_of. */
export function weekOf(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; parse it back as a plain calendar date in UTC.
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, dateStyle: "short" }).format(now);
  const day = new Date(`${local}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function weekOfMonth(weekOfDate: string): number {
  return Math.ceil(Number(weekOfDate.slice(8, 10)) / 7);
}

export function defaultPostType(weekOfDate: string = weekOf()): PostType {
  return ROTATION[Math.min(weekOfMonth(weekOfDate), ROTATION.length) - 1];
}
