"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dismissSlopFlag } from "./actions";

type Flag = { id: string; source: "lint" | "llm"; rule: string; quote: string; suggestion: string; dismissed: boolean };

/** Slop warnings for one draft. Fix, regenerate or dismiss; none of them block finalizing. */
export function FlagList({ flags }: { flags: Flag[] }) {
  const [pending, start] = useTransition();
  const open = flags.filter((f) => !f.dismissed);
  if (!open.length) return <p className="text-sm text-muted-foreground">No slop flags.</p>;

  return (
    <ul className="flex flex-col gap-2" aria-label="Slop flags">
      {open.map((f) => (
        <li key={f.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {f.rule}
              {f.source === "llm" && <span className="font-normal text-muted-foreground"> · AI review</span>}
            </span>
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await dismissSlopFlag(f.id).catch(() => void toast.error("Couldn't dismiss."));
                })
              }
            >
              Dismiss
            </Button>
          </div>
          <q className="text-muted-foreground">{f.quote}</q>
          {f.suggestion && <span>{f.suggestion}</span>}
        </li>
      ))}
    </ul>
  );
}
