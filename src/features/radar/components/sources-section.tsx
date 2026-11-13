import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSource, setSourceEnabled } from "../actions";
import { SOURCE_KINDS, type Source } from "../lib/candidates";
import { AddSourceForm } from "./add-source-form";

export function SourcesSection({ sources }: { sources: Source[] }) {
  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-3">
      <h2 id="sources-heading" className="text-lg font-semibold">
        Sources
      </h2>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources yet. Add one below.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <div className={`flex min-w-0 flex-1 flex-col ${s.enabled ? "" : "opacity-50"}`}>
                <span className="truncate text-sm font-medium">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {SOURCE_KINDS.find((k) => k.value === s.kind)?.label} · {s.kind === "search" ? s.query : s.url}
                </span>
              </div>
              <form action={setSourceEnabled.bind(null, s.id, !s.enabled)}>
                <Button type="submit" variant="ghost" size="sm" aria-label={`${s.enabled ? "Turn off" : "Turn on"} ${s.name}`}>
                  {s.enabled ? "On" : "Off"}
                </Button>
              </form>
              <form action={deleteSource.bind(null, s.id)}>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`}>
                  <Trash2Icon aria-hidden />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <AddSourceForm />
    </section>
  );
}
