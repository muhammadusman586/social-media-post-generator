import { notFound } from "next/navigation";
import { z } from "zod";
import { DraftsView } from "@/features/drafts/drafts-view";
import { getDraftContext, getLatestDrafts, getSlides } from "@/features/drafts/queries";
import { draftBlocker, proofMissing } from "@/features/interview/proof";

export const metadata = { title: "Drafts" };

export default async function Page({ params }: PageProps<"/posts/[id]/drafts">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, latest, slides] = await Promise.all([getDraftContext(id), getLatestDrafts(id), getSlides(id)]);
  if (!data) notFound();
  const { post, ctx } = data;
  const proof = { ...ctx, type: post.type };

  return (
    <DraftsView
      post={{ id: post.id, type: post.type, title: post.title || post.radarItem?.title || post.reflection?.question || "" }}
      drafts={[...latest.values()]}
      slides={slides}
      blocker={draftBlocker(proof)}
      // Lessons proof is an LLM check that runs at finalize.
      proofMissing={post.type === "lessons" ? null : proofMissing(proof)}
    />
  );
}
