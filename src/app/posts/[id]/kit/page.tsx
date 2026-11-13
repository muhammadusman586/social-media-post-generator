import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import type { Platform } from "@/db/schema";
import { formatThread, imagesFor, type KitImage } from "@/features/postkit/lib";
import { PostKit, type PlatformKit } from "@/features/postkit/post-kit";
import { getKit } from "@/features/postkit/queries";

export const metadata = { title: "Post kit" };

const ORDER: Platform[] = ["linkedin", "x", "instagram"];

export default async function Page({ params }: PageProps<"/posts/[id]/kit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const kit = await getKit(id);
  if (!kit) notFound();

  const slug = (kit.post.title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slides: KitImage[] = kit.slides.map((s, i) => ({
    url: s.pngUrl ?? `/api/slides/${s.id}`,
    name: `${slug}-${i + 1}.png`,
  }));
  const diagram = kit.diagramPngUrl ? { url: kit.diagramPngUrl, name: `${slug}-diagram.png` } : null;

  const platforms: PlatformKit[] = ORDER.flatMap((platform) => {
    const d = kit.finals[platform];
    if (!d) return [];
    const texts =
      platform === "x"
        ? formatThread(d.content.posts ?? [])
        : [(platform === "instagram" ? d.content.caption : d.content.text)?.trim() ?? ""].filter(Boolean);
    return [
      {
        platform,
        draftId: d.id,
        posted: Boolean(d.postedAt),
        texts,
        images: imagesFor(platform, slides, diagram),
      },
    ];
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/posts/${id}`} className="text-sm text-muted-foreground">
          ← Back to post
        </Link>
        <h1 className="text-2xl font-semibold">Post kit</h1>
        {kit.post.title ? <p className="text-sm text-muted-foreground">{kit.post.title}</p> : null}
      </div>
      {platforms.length ? (
        <PostKit platforms={platforms} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-4">
          <p className="text-sm">No final drafts yet. Mark a draft as final to get it here.</p>
          <Link href={`/posts/${id}/drafts`} className={buttonVariants()}>
            Go to drafts
          </Link>
        </div>
      )}
    </section>
  );
}
