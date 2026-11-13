import { CheckCircle2Icon, ChevronRightIcon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatWeek, STATUS_LABEL, TYPE_LABEL } from "@/features/posts/labels";
import { getPostOverview } from "@/features/posts/queries";
import { postSteps } from "@/features/posts/steps";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "Post" };

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  await requireOwner();
  const post = await getPostOverview((await params).id);
  if (!post) notFound();
  const steps = postSteps(post);

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Week of {formatWeek(post.weekOf)}</p>
        <h1 className="text-2xl font-semibold">{post.title || "Untitled post"}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{TYPE_LABEL[post.type]}</Badge>
          <Badge variant={post.status === "posted" ? "default" : "secondary"}>{STATUS_LABEL[post.status]}</Badge>
        </div>
      </header>

      {post.radarItem && (
        <a
          href={post.radarItem.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-1.5 text-sm text-muted-foreground hover:underline"
        >
          <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="break-all">{post.radarItem.url}</span>
        </a>
      )}
      {post.reflection && (
        <p className="text-sm text-muted-foreground">
          From your reflection:{" "}
          <Link href="/settings/reflections" className="underline underline-offset-4">
            {post.reflection.question}
          </Link>
        </p>
      )}

      <ol className="flex flex-col divide-y rounded-xl border">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link href={step.href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted">
              {step.done ? (
                <CheckCircle2Icon className="size-5 shrink-0 text-green-600" aria-label="Done" />
              ) : (
                <CircleIcon className="size-5 shrink-0 text-muted-foreground" aria-label="Not done" />
              )}
              <span className="flex-1 font-medium">
                {i + 1}. {step.label}
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
