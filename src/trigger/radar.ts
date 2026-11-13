import { schedules, task } from "@trigger.dev/sdk";
import { runRadar } from "@/features/radar/lib/run";

// One attempt: a retry repeats every Firecrawl and LLM call. The owner can press "Refresh radar".
const retry = { maxAttempts: 1 };

export const radarWeekly = schedules.task({
  id: "radar-weekly",
  cron: { pattern: "0 6 * * 1", timezone: "Asia/Karachi" },
  retry,
  run: (_payload, { ctx }) => runRadar({ triggerRunId: ctx.run.id }),
});

export const radarManual = task({
  id: "radar-manual",
  retry,
  run: (_payload: Record<string, never>, { ctx }) => runRadar({ triggerRunId: ctx.run.id }),
});
