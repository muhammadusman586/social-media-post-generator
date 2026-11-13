"use server";

import { del } from "@vercel/blob";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { writeExample, writeQuestions } from "./llm";
import {
  addUpload,
  approveExample,
  deleteUpload,
  getInterview,
  insertQuestions,
  markInterviewing,
  saveAnswers,
} from "./queries";

const id = z.uuid();
const answersSchema = z.array(z.object({ id: z.uuid(), answer: z.string().max(10_000) })).max(3);
const codeSchema = z.string().trim().min(1, "Paste some code first.").max(20_000);

export async function generateQuestions(postId: string) {
  await requireOwner();
  const post = await getInterview(id.parse(postId));
  if (!post) throw new Error("Post not found");
  if (post.interviewQas.length) return;
  const questions = await writeQuestions({ type: post.type, item: post.radarItem, reflection: post.reflection });
  await insertQuestions(post.id, questions);
  await markInterviewing(post.id);
  refresh();
}

export async function saveInterviewAnswers(postId: string, answers: { id: string; answer: string }[]) {
  await requireOwner();
  await saveAnswers(id.parse(postId), answersSchema.parse(answers));
}

export async function addCode(postId: string, code: string) {
  await requireOwner();
  await addUpload({ postId: id.parse(postId), kind: "code", codeText: codeSchema.parse(code) });
  refresh();
}

export async function removeUpload(postId: string, uploadId: string) {
  await requireOwner();
  const row = await deleteUpload(id.parse(postId), id.parse(uploadId));
  // Best effort: a leftover blob costs storage, not correctness.
  if (row?.blobUrl) await del(row.blobUrl).catch(() => {});
  refresh();
}

export async function generateExample(postId: string) {
  await requireOwner();
  const post = await getInterview(id.parse(postId));
  if (!post) throw new Error("Post not found");
  if (post.type !== "explain") throw new Error("Examples are only for Explain posts");
  const answers = post.interviewQas.flatMap((q) => (q.answer ? [`${q.question}\n${q.answer}`] : []));
  const { code } = await writeExample({ type: post.type, item: post.radarItem, reflection: post.reflection }, answers);
  await addUpload({ postId: post.id, kind: "code", codeText: code, isGenerated: true });
  refresh();
}

export async function approveGeneratedExample(postId: string, uploadId: string, code: string) {
  await requireOwner();
  await approveExample(id.parse(postId), id.parse(uploadId), codeSchema.parse(code));
  refresh();
}
