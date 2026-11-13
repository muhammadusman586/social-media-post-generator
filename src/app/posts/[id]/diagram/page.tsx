import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DiagramPanel } from "@/features/diagrams/components/diagram-panel";
import { getDiagramPageData } from "@/features/diagrams/queries";

export const metadata: Metadata = { title: "Diagram" };

export default async function Page({ params }: PageProps<"/posts/[id]/diagram">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const post = await getDiagramPageData(id);
  if (!post) notFound();
  const d = post.diagram;

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link href={`/posts/${id}`} className="text-sm text-muted-foreground">
          ← Back to post
        </Link>
        <h1 className="text-2xl font-semibold">Diagram</h1>
        {post.title && <p className="text-sm text-muted-foreground">{post.title}</p>}
        {d && <p className="text-xs text-muted-foreground">Saves as you edit. Easier to edit on a laptop.</p>}
      </header>
      <DiagramPanel
        // Remount the canvas when a new spec replaces the old one (not on every autosave).
        key={d ? JSON.stringify(d.spec) : "none"}
        postId={id}
        diagram={d ? { spec: d.spec, snapshot: d.tldrawSnapshot, pngUrl: d.pngUrl } : null}
      />
    </>
  );
}
