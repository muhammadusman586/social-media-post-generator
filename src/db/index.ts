import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

function connect() {
  return drizzle({ client: neon(requireEnv("DATABASE_URL")), schema, casing: "snake_case" });
}

let instance: ReturnType<typeof connect> | undefined;

/**
 * Lazily connected Drizzle client (Neon HTTP driver). Safe to import at build time;
 * throws only when first called without DATABASE_URL.
 * The HTTP driver has no interactive transactions: use `getDb().batch([...])` instead.
 */
export function getDb() {
  instance ??= connect();
  return instance;
}

export * as schema from "./schema";
