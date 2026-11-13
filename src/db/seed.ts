/** Seeds default Radar sources and reflection questions. Idempotent: skips rows that already exist. */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export const DEFAULT_SOURCES = [
  { name: "Hacker News front page", url: "https://news.ycombinator.com/", kind: "hn" },
  { name: "GitHub trending", url: "https://github.com/trending", kind: "github_trending" },
  { name: "Next.js blog", url: "https://nextjs.org/blog", kind: "blog" },
  { name: "Vercel AI SDK releases", url: "https://github.com/vercel/ai/releases", kind: "changelog" },
  { name: "OpenAI news", url: "https://openai.com/news/", kind: "blog" },
  { name: "Anthropic news", url: "https://www.anthropic.com/news", kind: "blog" },
  { name: "Trigger.dev changelog", url: "https://trigger.dev/changelog", kind: "changelog" },
  { name: "Neon changelog", url: "https://neon.com/docs/changelog", kind: "changelog" },
  { name: "Vercel changelog", url: "https://vercel.com/changelog", kind: "changelog" },
  { name: "Clerk changelog", url: "https://clerk.com/changelog", kind: "changelog" },
  { name: "This week in AI engineering (search)", query: "AI engineering news this week", kind: "search" },
] as const;

export const DEFAULT_REFLECTION_QUESTIONS = [
  "What did you get wrong this month, and how did you find out?",
  "What did you believe as a junior that you no longer believe?",
  "Which bug took you longest to fix recently, and what was the real cause?",
  "What did a code review teach you lately?",
  "What would you tell yourself on day one of your first job?",
  "Which tool or habit saved you the most time this month?",
  "When did you last push back on a requirement, and what happened?",
  "What did you ship that you would build differently now, and why?",
];

async function main() {
  const { getDb, schema } = await import("./index");
  const db = getDb();

  const haveSources = new Set((await db.select({ name: schema.sources.name }).from(schema.sources)).map((r) => r.name));
  const newSources = DEFAULT_SOURCES.filter((s) => !haveSources.has(s.name));
  if (newSources.length) await db.insert(schema.sources).values([...newSources]);

  const haveQuestions = new Set(
    (await db.select({ q: schema.reflections.question }).from(schema.reflections)).map((r) => r.q),
  );
  const newQuestions = DEFAULT_REFLECTION_QUESTIONS.filter((q) => !haveQuestions.has(q));
  if (newQuestions.length) await db.insert(schema.reflections).values(newQuestions.map((question) => ({ question })));

  console.log(`Seeded ${newSources.length} sources, ${newQuestions.length} reflection questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
