import { defineConfig } from "@trigger.dev/sdk";

/**
 * Trigger.dev v4 config. Tasks live in src/trigger/ (named exports, unique ids).
 * Run locally with `npm run trigger:dev` after `npx trigger.dev@4.8.5 login`.
 * Set TRIGGER_PROJECT_REF (proj_...) for the CLI and TRIGGER_SECRET_KEY for the app.
 * Tasks run on Trigger.dev, not Vercel: give them their own env vars in the Trigger.dev dashboard.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./src/trigger"],
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10000, randomize: true },
  },
});
