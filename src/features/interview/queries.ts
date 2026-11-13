import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interviewQas, posts, uploads } from "@/db/schema";

export async function getInterview(postId: string) {
  return getDb().query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      radarItem: true,
      reflection: true,
      interviewQas: { orderBy: (q, { asc }) => [asc(q.order)] },
      uploads: { orderBy: (u, { asc }) => [asc(u.createdAt)] },
      diagram: { columns: { id: true } },
    },
  });
}

export type Interview = NonNullable<Awaited<ReturnType<typeof getInterview>>>;

export async function insertQuestions(postId: string, questions: string[]) {
  if (!questions.length) return;
  await getDb()
    .insert(interviewQas)
    .values(questions.map((question, i) => ({ postId, order: i + 1, question })))
    .onConflictDoNothing();
}

export async function saveAnswers(postId: string, answers: { id: string; answer: string }[]) {
  const db = getDb();
  const [first, ...rest] = answers.map((a) =>
    db
      .update(interviewQas)
      .set({ answer: a.answer.trim() || null })
      .where(and(eq(interviewQas.id, a.id), eq(interviewQas.postId, postId))),
  );
  if (first) await db.batch([first, ...rest]);
}

export async function addUpload(row: typeof uploads.$inferInsert) {
  const [created] = await getDb().insert(uploads).values(row).returning();
  return created;
}

export async function deleteUpload(postId: string, id: string) {
  const [row] = await getDb()
    .delete(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.postId, postId)))
    .returning();
  return row;
}

export async function approveExample(postId: string, id: string, codeText: string) {
  await getDb()
    .update(uploads)
    .set({ codeText, approvedAt: new Date() })
    .where(and(eq(uploads.id, id), eq(uploads.postId, postId), eq(uploads.isGenerated, true)));
}

/** Move a new post into the interview step (never moves a post backwards). */
export async function markInterviewing(postId: string) {
  await getDb()
    .update(posts)
    .set({ status: "interview" })
    .where(and(eq(posts.id, postId), eq(posts.status, "draft")));
}
