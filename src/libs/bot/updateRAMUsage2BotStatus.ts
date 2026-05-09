// Import `Constants` directly from `@libs/constants.ts` rather than the
// `@libs` barrel: re-entering the barrel from inside `@libs/bot/...`
// triggers a circular-import TDZ error when this module is loaded
// directly (e.g., from a test) instead of via the production entry
// point. The runtime semantics are unchanged.
import { Constants } from "@libs/constants.ts";
import { ActivityTypes, Bot, editBotStatus } from "discordeno";

/**
 * Builds the discordeno status payload for a given memory snapshot.
 *
 * Pure: takes the raw byte counts in, returns the payload that would be
 * passed to `editBotStatus`. Extracted from `updateRAMUsage2BotStatus`
 * so the percentage formatting can be unit-tested without a real
 * `Deno.memoryUsage()` reading or a real Discord gateway.
 *
 * @param rss        - `Deno.memoryUsage().rss`         (bytes)
 * @param external   - `Deno.memoryUsage().external`    (bytes)
 * @param totalMemory - `Deno.systemMemoryInfo().total` (bytes)
 * @param now        - timestamp to stamp on the activity. Defaults to
 *                     `Date.now()`. Injectable for deterministic tests.
 */
export const buildRAMUsageStatusPayload = (
  rss: number,
  external: number,
  totalMemory: number,
  now: number = Date.now(),
) => {
  const usageMemory = rss + external;
  const memoryPercent = Number.parseFloat(
    `${(usageMemory / totalMemory) * 100}`,
  ).toFixed(2);
  return {
    activities: [
      {
        name: `RAM Usage: ${memoryPercent}%`,
        type: ActivityTypes.Game,
        createdAt: now,
      },
    ],
    status: "online" as const,
  };
};

/**
 * Updates the bot's status to its current RAM usage on a fixed interval.
 * @param {Bot} bot The bot instance.
 * @returns {void}
 */
const updateRAMUsage2BotStatus = (bot: Bot): void => {
  setInterval((): void => {
    const memory = Deno.memoryUsage();
    const totalMemory = Deno.systemMemoryInfo().total;
    const payload = buildRAMUsageStatusPayload(
      memory.rss,
      memory.external,
      totalMemory,
    );
    try {
      editBotStatus(bot, payload);
    } catch (e) {
      throw e as Error;
    }
  }, Constants.UPDATE_BOT_STATUS_INTERVAL);
};

export default updateRAMUsage2BotStatus;
