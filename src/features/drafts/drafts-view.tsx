"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Platform, PostType, SlideContent, slides as slidesTable } from "@/db/schema";
import { FlagList } from "@/features/slop/flag-list";
import { cn } from "@/lib/utils";
import { finalizePost, generateDrafts, regenerateDraft, reviewWithAi, saveDraft } from "./actions";
import type { LatestDraft } from "./queries";
import { formatThread, parseThread, X_LIMIT, xLength, xLimit } from "./x";

type Slide = Pick<(typeof slidesTable)["$inferSelect"], "kind" | "content">;
type Run = (fn: () => Promise<{ error?: string } | void>) => void;

const LABEL: Record<Platform, string> = { linkedin: "LinkedIn", x: "X", instagram: "Instagram" };
const ORDER: Platform[] = ["linkedin", "x", "instagram"];

function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const run: Run = (fn) =>
    start(async () => {
      try {
        const res = await fn();
        if (res?.error) toast.error(res.error);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return [pending, run];
}

export function DraftsView(props: {
  post: { id: string; type: PostType; title: string };
  drafts: LatestDraft[];
  slides: Slide[];
  blocker: string | null;
  proofMissing: string | null;
}) {
  const { post, drafts, slides, blocker, proofMissing } = props;
  const router = useRouter();
  const [pending, run] = useRun();
  const [blockers, setBlockers] = useState<string[]>([]);
  const byPlatform = new Map(drafts.map((d) => [d.platform, d]));
  const finalized = drafts.length === ORDER.length && drafts.every((d) => d.isFinal);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/posts/${post.id}`} className="text-sm text-muted-foreground">
          ← Post
        </Link>
        <h1 className="text-2xl font-semibold">Drafts</h1>
        {post.title && <p className="text-sm text-muted-foreground">{post.title}</p>}
        <nav className="flex gap-4 text-sm">
          <Link href={`/posts/${post.id}/interview`} className="underline underline-offset-4">
            Interview
          </Link>
          {post.type !== "lessons" && (
            <Link href={`/posts/${post.id}/diagram`} className="underline underline-offset-4">
              Diagram
            </Link>
          )}
        </nav>
      </header>

      {drafts.length === 0 ? (
        <div className="flex flex-col gap-2">
          {blocker && <p className="text-sm text-destructive">{blocker}</p>}
          <Button size="lg" disabled={pending || Boolean(blocker)} onClick={() => run(() => generateDrafts(post.id))}>
            {pending ? "Writing drafts…" : "Write drafts"}
          </Button>
        </div>
      ) : (
        <>
          {proofMissing && <p className="rounded-lg border p-3 text-sm">{proofMissing}</p>}

          <Tabs defaultValue="linkedin">
            <TabsList className="w-full">
              {ORDER.map((p) => (
                <TabsTrigger key={p} value={p}>
                  {LABEL[p]}
                </TabsTrigger>
              ))}
            </TabsList>
            {ORDER.map((p) => {
              const draft = byPlatform.get(p);
              return (
                <TabsContent key={p} value={p} keepMounted className="flex flex-col gap-4 pt-2">
                  {draft ? (
                    // Remount on a new version so the editor shows the saved text.
                    <PlatformEditor key={draft.id} postId={post.id} draft={draft} slides={slides} />
                  ) : (
                    <Button variant="outline" disabled={pending} onClick={() => run(() => regenerateDraft(post.id, p, ""))}>
                      Write {LABEL[p]} draft
                    </Button>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          <div className="flex flex-col gap-2 border-t pt-4">
            {blockers.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-destructive">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <Button variant="outline" disabled={pending} onClick={() => run(() => reviewWithAi(post.id))}>
              Check with AI
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await finalizePost(post.id);
                  setBlockers(res.blockers ?? []);
                  if (!res.blockers) router.push(`/posts/${post.id}/kit`);
                })
              }
            >
              {finalized ? "Finalize again" : "Finalize"}
            </Button>
            {finalized && (
              <Link href={`/posts/${post.id}/kit`} className="text-center text-sm underline underline-offset-4">
                Open post kit
              </Link>
            )}
            <p className="text-xs text-muted-foreground">
              Finalize needs the proof and no [ADD: …] left. Slop flags are warnings.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function PlatformEditor({ postId, draft, slides }: { postId: string; draft: LatestDraft; slides: Slide[] }) {
  const [pending, run] = useRun();
  const [text, setText] = useState(draft.content.text ?? "");
  const [thread, setThread] = useState(formatThread(draft.content.posts ?? []));
  const [caption, setCaption] = useState(draft.content.caption ?? "");
  const [slideState, setSlides] = useState(slides);
  const [instruction, setInstruction] = useState("");
  const p = draft.platform;

  const save = () =>
    run(() =>
      saveDraft(
        postId,
        p,
        p === "linkedin" ? { text } : p === "x" ? { posts: parseThread(thread) } : { caption },
        p === "instagram" ? slideState : undefined,
      ),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Version {draft.version}</span>
        {draft.isFinal && <Badge variant="secondary">Final</Badge>}
      </div>

      {p === "linkedin" && <LinkedInEditor value={text} onChange={setText} />}
      {p === "x" && <XEditor value={thread} onChange={setThread} />}
      {p === "instagram" && (
        <InstagramEditor caption={caption} onCaption={setCaption} slides={slideState} onSlides={setSlides} />
      )}

      <Button disabled={pending} onClick={save}>
        Save
      </Button>

      <div className="flex gap-2">
        <Input
          placeholder="Optional: shorter, more blunt…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          aria-label={`Instruction for the new ${LABEL[p]} version`}
        />
        <Button variant="outline" disabled={pending} onClick={() => run(() => regenerateDraft(postId, p, instruction))}>
          {pending ? "Working…" : "Regenerate"}
        </Button>
      </div>

      <FlagList flags={draft.slopFlags} />
    </div>
  );
}

function LinkedInEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const tags = value.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  return (
    <div className="flex flex-col gap-1">
      <Textarea rows={14} value={value} onChange={(e) => onChange(e.target.value)} aria-label="LinkedIn post" />
      <p className={cn("text-xs text-muted-foreground", (words < 150 || words > 250 || tags > 3) && "text-destructive")}>
        {words} words (150-250) · {tags} hashtags (max 3)
      </p>
    </div>
  );
}

function XEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const posts = parseThread(value);
  const limit = xLimit(posts.length);
  return (
    <div className="flex flex-col gap-1">
      <Textarea rows={14} value={value} onChange={(e) => onChange(e.target.value)} aria-label="X post or thread" />
      <p className="text-xs text-muted-foreground">
        Separate thread posts with a line containing only ---. Don&apos;t number them; the post kit does.
      </p>
      <ol className="flex flex-col gap-0.5 text-xs">
        {posts.map((post, i) => {
          const n = xLength(post);
          return (
            <li key={i} className={cn("text-muted-foreground", n > limit && "text-destructive")}>
              Post {i + 1}: {n}/{limit}
              {limit < X_LIMIT && " (room left for numbering)"}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function InstagramEditor({
  caption,
  onCaption,
  slides,
  onSlides,
}: {
  caption: string;
  onCaption: (v: string) => void;
  slides: Slide[];
  onSlides: (s: Slide[]) => void;
}) {
  const edit = (i: number, patch: Partial<SlideContent>) =>
    onSlides(slides.map((s, j) => (j === i ? { ...s, content: { ...s.content, ...patch } } : s)));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Caption
        <Textarea rows={6} value={caption} onChange={(e) => onCaption(e.target.value)} />
      </label>
      {slides.length === 0 && <p className="text-sm text-muted-foreground">No slides for this post.</p>}
      {slides.map((s, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">
            Slide {i + 1} · {s.kind}
          </span>
          {s.kind !== "quote" && (
            <Input
              value={s.content.heading ?? ""}
              onChange={(e) => edit(i, { heading: e.target.value })}
              aria-label={`Slide ${i + 1} heading`}
            />
          )}
          {(s.kind === "text" || s.kind === "title") && (
            <Textarea
              rows={3}
              value={s.content.body ?? ""}
              onChange={(e) => edit(i, { body: e.target.value })}
              aria-label={`Slide ${i + 1} text`}
            />
          )}
          {s.kind === "code" && (
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={s.content.code ?? ""}
              onChange={(e) => edit(i, { code: e.target.value })}
              aria-label={`Slide ${i + 1} code`}
            />
          )}
          {s.kind === "quote" && (
            <Textarea
              rows={3}
              value={s.content.quote ?? ""}
              onChange={(e) => edit(i, { quote: e.target.value })}
              aria-label={`Slide ${i + 1} quote`}
            />
          )}
          {s.kind === "diagram" && <p className="text-xs text-muted-foreground">Uses the post&apos;s diagram image.</p>}
        </div>
      ))}
    </div>
  );
}
