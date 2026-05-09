import { Commands } from "@bot/commands.ts";
import { Secrets } from "@libs";
import { Match } from "functional";
import {
  Bot,
  createBot,
  Intents,
  Interaction,
  InteractionTypes,
} from "discordeno";
import { interactionCreate } from "@bot/interactionCreate.ts";
import { threadInteractionCreate } from "@bot/threadInteractionCreate.ts";
import { threadModalSubmit } from "@bot/threadModalSubmit.ts";

const bot: Bot = createBot({
  token: Secrets.DISCORD_TOKEN,
  intents: Intents.Guilds,
  events: {
    ready: (_bot, payload) => {
      console.log(`${payload.user.username} is ready!`);
    },
  },
});

// NOTE: slash command registration (including `threadDlCommand` and
// `threadDlSpoilerCommand`) was moved to `registerCommands` (see
// `src/bot/registerCommands.ts`) and is now invoked from `src/main.ts`
// before `startBot`. Keeping it out of `bot.ts`'s top-level lets unit
// tests import the bot setup without making a Discord REST call at module
// load time.

/**
 * Handles the interactionCreate event for the bot.
 *
 * Dispatches based on `interaction.type`:
 * - `ApplicationCommand`: route by command name to the matching handler
 *   (`/dl` and `/dl-spoiler` go to `interactionCreate`, `/threaddl` and
 *   `/threaddl-spoiler` go to `threadInteractionCreate` which opens a
 *   Modal so the user can paste many URLs).
 * - `ModalSubmit`: hand off to `threadModalSubmit`, which validates the
 *   customId prefix, extracts URLs, and runs the shared `runThreadFlow`.
 *
 * @param {Bot} b - The bot instance.
 * @param {Interaction} interaction - The interaction object.
 * @return {Promise<void>} - A promise that resolves when the function completes.
 */
bot.events.interactionCreate = async (
  b: Bot,
  interaction: Interaction,
): Promise<void> => {
  if (!interaction.data) return;

  if (interaction.type === InteractionTypes.ModalSubmit) {
    await threadModalSubmit({ b, data: interaction.data, interaction });
    return;
  }

  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const props = {
    b,
    data: interaction.data,
    interaction,
    commandType: "",
  };
  await Match(props.data.name)
    .with(
      Commands.dlCommand.name,
      async (commandType: string): Promise<void> => {
        props.commandType = commandType;
        await interactionCreate(props);
      },
    )
    .with(
      Commands.dlSpoilerCommand.name,
      async (commandType: string): Promise<void> => {
        props.commandType = commandType;
        await interactionCreate(props);
      },
    )
    .with(
      Commands.threadDlCommand.name,
      async (commandType: string): Promise<void> => {
        props.commandType = commandType;
        await threadInteractionCreate(props);
      },
    )
    .with(
      Commands.threadDlSpoilerCommand.name,
      async (commandType: string): Promise<void> => {
        props.commandType = commandType;
        await threadInteractionCreate(props);
      },
    )
    .otherwise((): void => {});
};

export default bot;
