import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { parseNewPostParams } from "@/features/posts/new-post";
import { startPost } from "@/features/posts/queries";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "New post" };

const FIELDS = ["type", "radarItemId", "reflectionId"] as const;

async function startPostAction(formData: FormData) {
  "use server";
  await requireOwner();
  const params: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = formData.get(f);
    if (typeof v === "string" && v) params[f] = v;
  }
  const parsed = parseNewPostParams(params);
  const result = parsed.ok ? await startPost(parsed.value) : { error: parsed.error };
  if ("postId" in result) {
    redirect(result.created ? `/posts/${result.postId}/interview` : `/posts/${result.postId}`);
  }
  redirect(`/posts/new?${new URLSearchParams({ ...params, error: result.error })}`);
}

/**
 * `/posts/new?type=<explain|tried|lessons>&radarItemId=<uuid>` or `&reflectionId=<uuid>`.
 * GET only shows a confirm button, so link prefetching can never create posts.
 */
export default async function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  await requireOwner();
  const sp = await searchParams;
  const parsed = parseNewPostParams(sp);
  const message = typeof sp.error === "string" ? sp.error : parsed.ok ? null : parsed.error;

  if (message) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Can&apos;t start this post</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "self-start" })}>
          Back to home
        </Link>
      </section>
    );
  }

  return (
    <form action={startPostAction} className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Start this post?</h1>
      {FIELDS.map((f) =>
        typeof sp[f] === "string" ? <input key={f} type="hidden" name={f} value={sp[f]} /> : null,
      )}
      <Button type="submit" className="self-start">
        Start post
      </Button>
    </form>
  );
}
