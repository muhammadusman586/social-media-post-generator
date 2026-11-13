import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AddQuestionForm, AnswerForm } from "@/features/reflections/components/forms";
import { listAnswered, listUnanswered } from "@/features/reflections/queries";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "Reflections" };

export default async function ReflectionsPage() {
  await requireOwner();
  const [open, answered] = await Promise.all([listUnanswered(), listAnswered()]);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Reflections</h1>
        <p className="text-sm text-muted-foreground">Answered reflections become the source for lessons posts.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Answered ({answered.length})</h2>
        {answered.length === 0 && <p className="text-sm text-muted-foreground">Nothing answered yet.</p>}
        <ul className="flex flex-col gap-3">
          {answered.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{r.question}</p>
                {r.used && <Badge variant="secondary">Used</Badge>}
              </div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{r.answer}</p>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Edit answer</summary>
                <div className="pt-2">
                  <AnswerForm id={r.id} question={r.question} answer={r.answer} />
                </div>
              </details>
              {!r.used && (
                <Link
                  href={`/posts/new?type=lessons&reflectionId=${r.id}`}
                  prefetch={false}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
                >
                  Write a lessons post
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Unanswered ({open.length})</h2>
        <ul className="flex flex-col gap-3">
          {open.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{r.question}</summary>
                <div className="pt-2">
                  <AnswerForm id={r.id} question={r.question} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <AddQuestionForm />
      </section>
    </>
  );
}
