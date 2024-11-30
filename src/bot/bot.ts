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

/**
 * Handles the interactionCreate event for the bot.
 *
 * @param {Bot} b - The bot instance.
 * @param {Interaction} interaction - The interaction object.
 * @return {Promise<void>} - A promise that resolves when the function completes.
 */
bot.events.interactionCreate = async (
  b: Bot,
  interaction: Interaction
): Promise<void> => {
  await Match(interaction.data?.name)
    .with(
      Commands.dlCommand.name,
      (): Promise<void> =>
        interactionCreate(b, interaction, Commands.dlCommand.name)
    )
    .otherwise((): void => {});
};

export default bot;
