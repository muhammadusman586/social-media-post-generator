import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

/** True only for the Clerk user in OWNER_CLERK_USER_ID. Fails closed when it is unset. */
export function isOwner(userId: string | null | undefined): boolean {
  const owner = env("OWNER_CLERK_USER_ID");
  return Boolean(owner && userId === owner);
}

/**
 * Call at the top of every server action and route handler (defense in depth; the
 * proxy already blocks non-owners). Returns the owner's user id or throws.
 */
export async function requireOwner(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !isOwner(userId)) throw new Error("Not allowed");
  return userId;
}
