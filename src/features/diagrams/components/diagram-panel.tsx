"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiagramSpec } from "@/db/schema";
import { proposeDiagram } from "../actions";

const DiagramEditor = dynamic(() => import("./diagram-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-[70dvh] w-full" />,
});

type Props = {
  postId: string;
  diagram: { spec: DiagramSpec; snapshot: unknown; pngUrl: string | null } | null;
};

export function DiagramPanel({ postId, diagram }: Props) {
  const [pending, startTransition] = useTransition();
  const [declined, setDeclined] = useState<string | null>(null);

  function ask(force: boolean) {
    if (force && diagram && !window.confirm("Ask the AI for a new diagram? This replaces the canvas and the export.")) return;
    startTransition(async () => {
      const res = await proposeDiagram(postId, force);
      if (!res.ok) return void toast.error(res.error);
      setDeclined(res.useful ? null : res.reason);
    });
  }

  if (!diagram) {
    return (
      <section className="flex flex-col gap-3">
        {declined ? (
          <>
            <p className="text-sm">No diagram suggested: {declined}</p>
            <Button onClick={() => ask(true)} disabled={pending}>
              {pending ? "Drawing..." : "Make one anyway"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              The AI checks whether a diagram helps this post, using only the radar item and your answers.
            </p>
            <Button onClick={() => ask(false)} disabled={pending}>
              {pending ? "Thinking..." : "Suggest a diagram"}
            </Button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <DiagramEditor postId={postId} spec={diagram.spec} snapshot={diagram.snapshot} pngUrl={diagram.pngUrl} />
      <Button variant="ghost" className="self-start" onClick={() => ask(true)} disabled={pending}>
        {pending ? "Drawing..." : "New diagram from AI"}
      </Button>
    </section>
  );
}
