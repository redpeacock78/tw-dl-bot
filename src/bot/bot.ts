import { Commands } from "@bot/commands.ts";
import { Secrets } from "@libs";
import { Match } from "functional";
import { Bot, createBot, Intents, Interaction } from "discordeno";
import { interactionCreate } from "@bot/interactionCreate.ts";

const bot: Bot = createBot({
  token: Secrets.DISCORD_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
  events: {
    ready: (_bot, payload) => {
      console.log(`${payload.user.username} is ready!`);
    },
  },
});

await bot.helpers.createGlobalApplicationCommand(Commands.dlCommand);
await bot.helpers.createGlobalApplicationCommand(Commands.dlSpoilerCommand);

/**
 * Handles the interactionCreate event for the bot.
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
    .otherwise((): void => {});
};

export default bot;
