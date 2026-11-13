"use server";

import { tasks } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { env } from "@/lib/env";
import type { radarManual } from "@/trigger/radar";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function refreshRadar(): Promise<ActionResult> {
  await requireOwner();
  if (!env("TRIGGER_SECRET_KEY")) {
    return { ok: false, error: "Refresh needs Trigger.dev. Set TRIGGER_SECRET_KEY and try again." };
  }
  try {
    await tasks.trigger<typeof radarManual>("radar-manual", {});
  } catch (err) {
    console.error("radar: trigger failed", err);
    return { ok: false, error: "Could not start the radar run. Check the Trigger.dev setup." };
  }
  revalidatePath("/radar");
  return { ok: true, message: "Radar started. The shortlist updates in a minute or two." };
}

const sourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("search"), name: z.string().trim().min(1), query: z.string().trim().min(3) }),
  z.object({
    kind: z.enum(["hn", "github_trending", "changelog", "blog"]),
    name: z.string().trim().min(1),
    url: z.url({ protocol: /^https?$/ }),
  }),
]);

export async function addSource(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireOwner();
  const parsed = sourceInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      ok: false,
      error: form.get("kind") === "search" ? "Add a name and a search query." : "Add a name and a full https:// URL.",
    };
  }
  await getDb().insert(schema.sources).values(parsed.data);
  revalidatePath("/radar");
  return { ok: true };
}

const id = z.uuid();

export async function setSourceEnabled(sourceId: string, enabled: boolean) {
  await requireOwner();
  await getDb()
    .update(schema.sources)
    .set({ enabled: z.boolean().parse(enabled) })
    .where(eq(schema.sources.id, id.parse(sourceId)));
  revalidatePath("/radar");
}

export async function deleteSource(sourceId: string) {
  await requireOwner();
  await getDb().delete(schema.sources).where(eq(schema.sources.id, id.parse(sourceId)));
  revalidatePath("/radar");
}
