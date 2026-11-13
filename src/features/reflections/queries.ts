import { asc, desc, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { reflections } from "@/db/schema";

/** This week's reflection question: the oldest one without an answer. */
export async function getNextQuestion() {
  const [row] = await getDb()
    .select()
    .from(reflections)
    .where(isNull(reflections.answer))
    .orderBy(asc(reflections.createdAt), asc(reflections.question))
    .limit(1);
  return row;
}

export async function listUnanswered() {
  return getDb()
    .select()
    .from(reflections)
    .where(isNull(reflections.answer))
    .orderBy(asc(reflections.createdAt), asc(reflections.question));
}

export async function listAnswered() {
  return getDb()
    .select()
    .from(reflections)
    .where(isNotNull(reflections.answer))
    .orderBy(desc(reflections.answeredAt));
}
