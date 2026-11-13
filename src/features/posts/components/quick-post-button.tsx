"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { quickPost, type QuickPostState } from "../quick-post";

export function QuickPostButton() {
  const [state, action, pending] = useActionState<QuickPostState>(() => quickPost(), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Writing your post…" : "⚡ Quick post"}
      </Button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending
          ? "Picking a topic, writing LinkedIn, X and Instagram drafts and the diagram. About 30 seconds."
          : "One tap: picks a topic and writes every draft plus the diagram. You review, then finalize."}
      </p>
      {state.error && (
        <p className="text-sm text-destructive">
          {state.error}{" "}
          {state.postId && (
            <Link href={`/posts/${state.postId}`} className="underline">
              Open post
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
