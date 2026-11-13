import { openai } from "@ai-sdk/openai";
import { requireEnv } from "@/lib/env";

/**
 * The OpenAI model for every LLM call (server-side only). The model id comes from
 * OPENAI_MODEL so it can change without a deploy; @ai-sdk/openai reads OPENAI_API_KEY.
 * Use with `generateText` / `streamText` from "ai" (structured output: `output: Output.object(...)`).
 */
export function getModel() {
  return openai(requireEnv("OPENAI_MODEL"));
}
