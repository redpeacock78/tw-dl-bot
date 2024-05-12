import { KyResponse } from "ky";
import { Commands } from "@bot/commands.ts";
import { Secrets, Messages, isUrl, webhook } from "@libs";
import {
  Bot,
  createBot,
  Intents,
  Interaction,
  InteractionResponseTypes,
  Message,
} from "discordeno";

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
  switch (interaction.data?.name) {
    case Commands.dlCommand.name: {
      const contents: string[] = interaction.data.options
        ?.map((i) => i.value)
        .join("")
        .split(" ") as string[];
      await b.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        }
      );
      if (!contents.every((i: string): boolean => isUrl(i))) {
        await b.helpers.sendFollowupMessage(interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: Messages.createErrorMessage({
            description: contents.join("\n"),
          }),
        });
      } else {
        await Promise.all(
          contents.map(
            async (content: string): Promise<Message | KyResponse> =>
              await b.helpers
                .sendFollowupMessage(interaction.token, {
                  type: InteractionResponseTypes.ChannelMessageWithSource,
                  data: Messages.createProgressMessage({
                    content: `**🕑Queuing...**`,
                    link: contents.join("\n"),
                  }),
                })
                .then(
                  async (i: Message): Promise<Message | KyResponse> =>
                    await webhook({
                      content: content,
                      channelId: i.channelId,
                      id: i.id,
                      token: interaction.token,
                    }).catch(
                      async (e: Error): Promise<Message> =>
                        await b.helpers.editFollowupMessage(
                          interaction.token,
                          i.id,
                          Messages.createErrorMessage({
                            link: contents.join("\n"),
                            description: e.message,
                          })
                        )
                    )
                )
          )
        );
      }
      break;
    }
    default: {
      break;
    }
  }
};

export default bot;
