import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profile, voiceExamples } from "@/db/schema";

export async function getProfile() {
  const [row] = await getDb().select().from(profile).orderBy(asc(profile.createdAt)).limit(1);
  return row;
}

export async function listVoiceSamples() {
  return getDb()
    .select()
    .from(voiceExamples)
    .where(eq(voiceExamples.source, "sample"))
    .orderBy(desc(voiceExamples.createdAt));
}

export async function listRecentFinals(limit = 5) {
  return getDb()
    .select()
    .from(voiceExamples)
    .where(eq(voiceExamples.source, "final_post"))
    .orderBy(desc(voiceExamples.createdAt))
    .limit(limit);
}
