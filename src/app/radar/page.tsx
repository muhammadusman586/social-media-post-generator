import type { Metadata } from "next";
import { RadarCard } from "@/features/radar/components/radar-card";
import { RefreshButton } from "@/features/radar/components/refresh-button";
import { SourcesSection } from "@/features/radar/components/sources-section";
import { getRadarView, listSources } from "@/features/radar/queries";

export const metadata: Metadata = { title: "Radar" };
// Reads the DB on every request; never prerender at build (no DATABASE_URL there).
export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function RadarPage() {
  const [{ latest, lastDone }, sources] = await Promise.all([getRadarView(), listSources()]);
  const items = lastDone?.items ?? [];

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Radar</h1>
          <RefreshButton />
        </div>
        <p className="text-sm text-muted-foreground">
          {!latest && "No runs yet. It runs every Monday at 6:00."}
          {latest?.status === "running" && `Running since ${when(latest.startedAt)}.`}
          {latest?.status === "done" && `Last run ${when(latest.finishedAt ?? latest.startedAt)}.`}
          {latest?.status === "failed" && `Last run failed ${when(latest.finishedAt ?? latest.startedAt)}: ${latest.error ?? "unknown error"}`}
        </p>
      </header>

      {items.length ? (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <RadarCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {lastDone ? "The last run found nothing new." : "No shortlist yet."} Tap Refresh radar or wait for Monday.
        </p>
      )}

      <SourcesSection sources={sources} />
    </>
  );
}
