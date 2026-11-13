import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { parseNewPostParams } from "@/features/posts/new-post";
import { startPost } from "@/features/posts/queries";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "New post" };

/**
 * `/posts/new?type=<explain|tried|lessons>&radarItemId=<uuid>` or `&reflectionId=<uuid>`.
 * Creates the post (or finds the one that already exists for that source) and redirects.
 * Dynamic page with no loading.tsx, so <Link> never prefetches it; keep it that way.
 */
export default async function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  await requireOwner();
  const parsed = parseNewPostParams(await searchParams);
  const result = parsed.ok ? await startPost(parsed.value) : { error: parsed.error };
  if ("postId" in result) {
    redirect(result.created ? `/posts/${result.postId}/interview` : `/posts/${result.postId}`);
  }

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Can&apos;t start this post</h1>
      <p className="text-sm text-muted-foreground">{result.error}</p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "self-start" })}>
        Back to home
      </Link>
    </section>
  );
}
