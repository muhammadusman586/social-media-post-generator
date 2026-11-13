"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCode, approveGeneratedExample, generateExample, removeUpload } from "./actions";
import type { Interview } from "./queries";

type Upload = Interview["uploads"][number];

export function ProofPanel({ post }: { post: Interview }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });

  const upload = (file: File) =>
    run(async () => {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/posts/${post.id}/interview/upload`, { method: "POST", body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed.");
      router.refresh();
    });

  const hasExample = post.uploads.some((u) => u.isGenerated);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Proof</h2>
        <p className="text-sm text-muted-foreground">
          {post.type === "tried"
            ? "Optional: a screenshot or code once you've tried it. Without it you get a first-look post; add it later and regenerate."
            : "Needed before finalizing: a diagram or a code snippet."}
        </p>
      </div>

      {post.uploads.map((u) => (
        <UploadItem key={u.id} postId={post.id} upload={u} pending={pending} run={run} />
      ))}

      <label className="flex flex-col gap-2 text-sm font-medium">
        Add a screenshot
        <input
          type="file"
          accept="image/*"
          disabled={pending}
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Or paste code
        <Textarea rows={5} className="font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <Button
        variant="outline"
        disabled={pending || !code.trim()}
        onClick={() =>
          run(async () => {
            await addCode(post.id, code);
            setCode("");
          })
        }
      >
        Add code
      </Button>

      {post.type === "explain" && (
        <div className="flex flex-col gap-2">
          <Link href={`/posts/${post.id}/diagram`} className="text-sm underline underline-offset-4">
            Make a diagram instead
          </Link>
          {!hasExample && (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => generateExample(post.id))}>
              Write an example snippet for me
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function UploadItem({
  postId,
  upload: u,
  pending,
  run,
}: {
  postId: string;
  upload: Upload;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [code, setCode] = useState(u.codeText ?? "");
  const remove = (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeUpload(postId, u.id))}>
      Delete
    </Button>
  );

  if (u.kind === "image" && u.blobUrl) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL, any host */}
        <img src={u.blobUrl} alt="Your screenshot" className="max-h-48 rounded" />
        {remove}
      </div>
    );
  }

  if (u.isGenerated && !u.approvedAt) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">AI-written example, approve or edit</p>
        <Textarea rows={10} className="font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} />
        <div className="flex gap-2">
          <Button disabled={pending || !code.trim()} onClick={() => run(() => approveGeneratedExample(postId, u.id, code))}>
            Approve
          </Button>
          {remove}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        {u.isGenerated ? <Badge variant="secondary">AI-written example, approved</Badge> : <Badge variant="outline">Your code</Badge>}
        {remove}
      </div>
      <pre className="overflow-x-auto font-mono text-xs whitespace-pre">{u.codeText}</pre>
    </div>
  );
}
