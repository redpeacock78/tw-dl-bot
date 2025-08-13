import { Constants } from "@libs";
import { Bot, editBotStatus, ActivityTypes } from "discordeno";

/**
 * Updates the bot's status to its current RAM usage.
 * @param {Bot} bot The bot instance.
 * @returns {void}
 */
const updateRAMUsage2BotStatus = (bot: Bot): void => {
  setInterval((): void => {
    const usageMemory = Deno.memoryUsage().rss + Deno.memoryUsage().external;
    const totalMemory = Deno.systemMemoryInfo().total;
    const memoryPercent = Number.parseFloat(
      `${(usageMemory / totalMemory) * 100}`
    ).toFixed(2);
    try {
      editBotStatus(bot, {
        activities: [
          {
            name: `RAM Usage: ${memoryPercent}%`,
            type: ActivityTypes.Game,
            createdAt: Date.now(),
          },
        ],
        status: "online",
      });
    } catch (e) {
      throw e as Error;
    }
  }, Constants.UPDATE_BOT_STATUS_INTERVAL);
};

export default updateRAMUsage2BotStatus;
