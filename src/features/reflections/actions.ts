"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { reflections } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { isUuid } from "@/features/posts/new-post";

export type ActionResult = { error?: string };

const field = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

export async function answerReflection(form: FormData): Promise<ActionResult> {
  await requireOwner();
  const id = form.get("id");
  const answer = field(form, "answer", 5000);
  if (!isUuid(id)) return { error: "Unknown reflection." };
  if (!answer) return { error: "Write an answer first." };

  const updated = await getDb()
    .update(reflections)
    .set({ answer, answeredAt: new Date() })
    .where(eq(reflections.id, id))
    .returning({ id: reflections.id });
  if (!updated.length) return { error: "Unknown reflection." };
  refresh();
  return {};
}

export async function addQuestion(form: FormData): Promise<ActionResult> {
  await requireOwner();
  const question = field(form, "question", 300);
  if (!question) return { error: "Write a question first." };
  await getDb().insert(reflections).values({ question });
  refresh();
  return {};
}
