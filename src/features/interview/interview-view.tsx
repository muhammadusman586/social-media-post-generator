"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateDrafts } from "@/features/drafts/actions";
import { generateQuestions, saveInterviewAnswers } from "./actions";
import { draftBlocker } from "./proof";
import { ProofPanel } from "./proof-panel";
import type { Interview } from "./queries";

export function InterviewView({ post }: { post: Interview }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() => Object.fromEntries(post.interviewQas.map((q) => [q.id, q.answer ?? ""])));
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"questions" | "save" | "drafts" | null>(null);
  const hasDrafts = post.status === "drafted" || post.status === "posted";

  const run = (what: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(what);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    });
  };

  const save = () => saveInterviewAnswers(post.id, Object.entries(answers).map(([id, answer]) => ({ id, answer })));
  const blocker = draftBlocker({ type: post.type, uploads: post.uploads, hasDiagram: Boolean(post.diagram) });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/posts/${post.id}`} className="text-sm text-muted-foreground">
          ← Post
        </Link>
        <h1 className="text-2xl font-semibold">Interview</h1>
        <p className="text-sm text-muted-foreground">
          {post.radarItem ? (
            <a href={post.radarItem.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {post.radarItem.title}
            </a>
          ) : (
            (post.reflection?.question ?? post.title)
          )}
        </p>
      </header>

      {post.type === "lessons" && (
        <p className="rounded-lg border p-3 text-sm">
          Don&apos;t name clients or employers. Describe the situation instead: what happened, what you did, what changed.
        </p>
      )}

      {post.interviewQas.length === 0 ? (
        <Button size="lg" disabled={pending} onClick={() => run("questions", () => generateQuestions(post.id))}>
          {busy === "questions" ? "Writing questions…" : "Get questions"}
        </Button>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            Rough words are fine. Tap the keyboard mic to dictate. English, Roman Urdu or both.
          </p>
          {post.interviewQas.map((q) => (
            <label key={q.id} className="flex flex-col gap-2">
              <span className="font-medium">{q.question}</span>
              <Textarea
                rows={5}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                onBlur={() => save().catch(() => toast.error("Couldn't save your answer."))}
              />
            </label>
          ))}
        </div>
      )}

      {post.type !== "lessons" && <ProofPanel post={post} />}

      {post.interviewQas.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocker && <p className="text-sm text-destructive">{blocker}</p>}
          <Button
            size="lg"
            disabled={pending || Boolean(blocker)}
            onClick={() =>
              run("drafts", async () => {
                await save();
                const { error } = await generateDrafts(post.id);
                if (error) throw new Error(error);
                router.push(`/posts/${post.id}/drafts`);
              })
            }
          >
            {busy === "drafts" ? "Writing drafts…" : hasDrafts ? "Write new drafts" : "Write drafts"}
          </Button>
          {hasDrafts && (
            <Link href={`/posts/${post.id}/drafts`} className="text-center text-sm underline underline-offset-4">
              Go to drafts
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
