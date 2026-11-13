import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickPostButton } from "@/features/posts/components/quick-post-button";
import { TopicPostForm } from "@/features/posts/components/topic-post-form";
import { formatWeek, STATUS_LABEL, TYPE_LABEL } from "@/features/posts/labels";
import { getRadarShortlist, getWeekPost } from "@/features/posts/queries";
import { AnswerForm } from "@/features/reflections/components/forms";
import { pickableReflections, showLessonsEntry } from "@/features/reflections/lessons";
import { getNextQuestion, listAnswered } from "@/features/reflections/queries";
import { requireOwner } from "@/lib/auth";
import { defaultPostType, weekOf } from "@/lib/week";

export default async function HomePage() {
  await requireOwner();
  const week = weekOf();
  const type = defaultPostType(week);
  const [post, shortlist, question, answered] = await Promise.all([
    getWeekPost(week),
    getRadarShortlist(3),
    getNextQuestion(),
    listAnswered(),
  ]);
  const lessons = showLessonsEntry(type, Boolean(post)) ? pickableReflections(answered) : null;

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Week of {formatWeek(week)}</p>
        <h1 className="text-2xl font-semibold">This week: {TYPE_LABEL[type]}</h1>
      </header>

      <QuickPostButton />
      <TopicPostForm />

      <Card>
        <CardHeader>
          <CardDescription>{post ? TYPE_LABEL[post.type] : "Suggested type"}</CardDescription>
          <CardTitle>{post ? post.title || "Untitled post" : TYPE_LABEL[type]}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <Badge variant={post?.status === "posted" ? "default" : "secondary"}>
            {STATUS_LABEL[post?.status ?? "draft"]}
          </Badge>
          {post ? (
            <Link href={`/posts/${post.id}`} className={buttonVariants({ size: "lg" })}>
              {post.status === "posted" ? "View post" : "Continue"}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">
              {type === "lessons" ? "Pick a reflection below" : "Pick a radar item below"}
            </span>
          )}
        </CardContent>
      </Card>

      {lessons && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Write a lessons post</h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Answer a reflection first, then pick it here as the post&apos;s source.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lessons.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">{r.question}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.answer}</p>
                  <Link
                    href={`/posts/new?type=lessons&reflectionId=${r.id}`}
                    prefetch={false}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
                  >
                    Write about this
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Radar</h2>
          <Link href="/radar" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            See all
          </Link>
        </div>
        {shortlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No radar items yet. The radar runs Monday morning.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shortlist.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-1 text-sm font-medium hover:underline"
                  >
                    {item.title}
                    <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  </a>
                  <Badge variant="outline">{TYPE_LABEL[item.suggestedType]}</Badge>
                </div>
                {item.whyItMatters && <p className="text-sm text-muted-foreground">{item.whyItMatters}</p>}
                <Link
                  href={`/posts/new?type=${item.suggestedType === "tried" ? "tried" : "explain"}&radarItemId=${item.id}`}
                  prefetch={false}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
                >
                  Write about this
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Reflection</h2>
          <Link
            href="/settings/reflections"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            All reflections
          </Link>
        </div>
        {question ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{question.question}</p>
            <AnswerForm key={question.id} id={question.id} question={question.question} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every question is answered.{" "}
            <Link href="/settings/reflections" className="underline underline-offset-4">
              Add your own
            </Link>
            .
          </p>
        )}
      </section>
    </>
  );
}
