import type { PostStatus, PostType } from "@/db/schema";

export type StepInput = {
  id: string;
  type: PostType;
  status: PostStatus;
  interviewQas: { answer: string | null }[];
  drafts: { isFinal: boolean; postedAt: Date | null }[];
  diagram: { pngUrl: string | null } | null | undefined;
};

export type Step = { key: string; label: string; href: string; done: boolean };

/** The post's workflow steps, with done state read from what is saved. */
export function postSteps(p: StepInput): Step[] {
  const base = `/posts/${p.id}`;
  const finals = p.drafts.filter((d) => d.isFinal);
  const steps: Step[] = [
    {
      key: "interview",
      label: "Interview",
      href: `${base}/interview`,
      done: p.interviewQas.length > 0 && p.interviewQas.every((q) => Boolean(q.answer?.trim())),
    },
    { key: "drafts", label: "Drafts", href: `${base}/drafts`, done: p.drafts.length > 0 },
  ];
  if (p.type !== "lessons") {
    steps.push({
      key: "diagram",
      label: p.type === "tried" ? "Diagram (optional)" : "Diagram",
      href: `${base}/diagram`,
      done: Boolean(p.diagram?.pngUrl),
    });
  }
  steps.push({
    key: "kit",
    label: "Post kit",
    href: `${base}/kit`,
    done: p.status === "posted" || (finals.length > 0 && finals.every((d) => d.postedAt)),
  });
  return steps;
}
