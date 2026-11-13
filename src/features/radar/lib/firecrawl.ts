import Firecrawl from "@mendable/firecrawl-js";
import { requireEnv } from "@/lib/env";

export type FirecrawlLike = Pick<Firecrawl, "search" | "scrape">;

/** Firecrawl client, created at call time so builds and tests never need the key. */
export function getFirecrawl(): FirecrawlLike {
  return new Firecrawl({ apiKey: requireEnv("FIRECRAWL_API_KEY") });
}
