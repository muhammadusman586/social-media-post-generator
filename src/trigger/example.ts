import { task } from "@trigger.dev/sdk";

/**
 * No-op task that proves the Trigger.dev wiring. Trigger it from server code with a
 * type-only import: `tasks.trigger<typeof ping>("ping", {})`.
 */
export const ping = task({
  id: "ping",
  run: async () => ({ ok: true }),
});
