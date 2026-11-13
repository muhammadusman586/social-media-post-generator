/**
 * Every env var the app reads, in one place. Nothing here throws at import or build
 * time: `env()` returns undefined when unset, `requireEnv()` throws only when called.
 *
 * Server-side only for secrets. Client components must read NEXT_PUBLIC_* vars as
 * literal `process.env.NEXT_PUBLIC_X` so Next can inline them.
 */
export const ENV_VARS = {
  DATABASE_URL: "Neon Postgres connection string",
  OPENAI_API_KEY: "OpenAI API key (read by @ai-sdk/openai)",
  OPENAI_MODEL: "OpenAI model id used for every LLM call",
  FIRECRAWL_API_KEY: "Firecrawl API key (Radar)",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "Clerk publishable key",
  CLERK_SECRET_KEY: "Clerk secret key",
  OWNER_CLERK_USER_ID: "The only Clerk user id allowed to use the app",
  TRIGGER_SECRET_KEY: "Trigger.dev environment secret key (to trigger tasks)",
  TRIGGER_PROJECT_REF: "Trigger.dev project ref (proj_...), read by trigger.config.ts",
  BLOB_READ_WRITE_TOKEN: "Vercel Blob token (uploads, exported PNGs)",
  NEXT_PUBLIC_TLDRAW_LICENSE_KEY: "tldraw license key (optional in development)",
} as const;

export type EnvVar = keyof typeof ENV_VARS;

export function env(name: EnvVar): string | undefined {
  return process.env[name] || undefined;
}

export function requireEnv(name: EnvVar): string {
  const value = env(name);
  if (!value) throw new Error(`Missing env var ${name}: ${ENV_VARS[name]}. See .env.example.`);
  return value;
}
