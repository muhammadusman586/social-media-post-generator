import Firecrawl from "@mendable/firecrawl-js";
import { requireEnv } from "@/lib/env";

/** The two Firecrawl calls the Radar uses. Tests pass a fake with this shape. */
export type FirecrawlLike = Pick<Firecrawl, "search" | "scrape">;

/** Firecrawl client, created at call time so builds and tests never need the key. */
export function getFirecrawl(): FirecrawlLike {
  return new Firecrawl({ apiKey: requireEnv("FIRECRAWL_API_KEY") });
}
