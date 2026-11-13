"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { topicPost, type QuickPostState } from "../quick-post";

export function TopicPostForm() {
  const [state, action, pending] = useActionState<QuickPostState, FormData>(topicPost, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="topic" className="text-sm font-medium">
        Post about a topic
      </label>
      <div className="flex gap-2">
        <Input
          id="topic"
          name="topic"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. MCP servers, React Server Components, RAG evals"
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : "Research & write"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending
          ? "Searching the web, reading the best sources, then writing drafts, diagram and code. About a minute."
          : "Finds the best sources with Firecrawl, then writes LinkedIn, X and Instagram drafts with a diagram or code when it helps."}
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
