import { Bot } from "discordeno";
import { Commands } from "@bot/commands.ts";

/**
 * Registers the bot's slash commands as global application commands.
 *
 * Extracted from `bot.ts` so that:
 *   1. Importing `bot.ts` no longer triggers a network REST call at module
 *      load time (previously a top-level `await`), which made `bot.ts` and
 *      anything that transitively imports it impossible to load in unit
 *      tests.
 *   2. The registration logic itself is independently testable with a
 *      stubbed `bot.helpers.createGlobalApplicationCommand` spy.
 *
 * Production callers (`src/main.ts`) invoke this once before `startBot`,
 * preserving the previous "commands registered before startup" ordering.
 *
 * @param bot - The bot instance (real or fake) whose helpers are used
 *   to register the commands.
 */
export const registerCommands = async (bot: Bot): Promise<void> => {
  await bot.helpers.createGlobalApplicationCommand(Commands.dlCommand);
  await bot.helpers.createGlobalApplicationCommand(Commands.dlSpoilerCommand);
  await bot.helpers.createGlobalApplicationCommand(Commands.threadDlCommand);
};
