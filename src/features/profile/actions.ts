"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { profile, voiceExamples } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { isUuid } from "@/features/posts/new-post";
import { getProfile } from "./queries";
import { parseTags } from "./tags";

type ActionResult = { error?: string };

const field = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
const tags = (form: FormData, name: string) => parseTags(String(form.get(name) ?? ""));

export async function saveProfile(form: FormData): Promise<ActionResult> {
  await requireOwner();
  const values = {
    handle: field(form, "handle", 60),
    bio: field(form, "bio", 1000),
    stack: tags(form, "stack"),
    projects: field(form, "projects", 5000),
    topics: tags(form, "topics"),
    avoidTopics: tags(form, "avoidTopics"),
    neverMention: tags(form, "neverMention"),
  };
  const existing = await getProfile();
  const db = getDb();
  if (existing) await db.update(profile).set(values).where(eq(profile.id, existing.id));
  else await db.insert(profile).values(values);
  refresh();
  return {};
}

export async function addVoiceSample(form: FormData): Promise<ActionResult> {
  await requireOwner();
  const text = field(form, "text", 5000);
  if (!text) return { error: "Paste some of your writing first." };
  await getDb().insert(voiceExamples).values({ text, source: "sample" });
  refresh();
  return {};
}

export async function deleteVoiceSample(form: FormData): Promise<ActionResult> {
  await requireOwner();
  const id = form.get("id");
  if (!isUuid(id)) return { error: "Unknown sample." };
  await getDb()
    .delete(voiceExamples)
    .where(and(eq(voiceExamples.id, id), eq(voiceExamples.source, "sample")));
  refresh();
  return {};
}
