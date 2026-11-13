"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { dismissFlag } from "./queries";

export async function dismissSlopFlag(flagId: string) {
  await requireOwner();
  await dismissFlag(z.uuid().parse(flagId));
  refresh();
}
