import ky, { KyResponse } from "ky";
import { Commands } from "@bot/commands.ts";
import { Secrets, Messages, isUrl } from "@libs";
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
                .then(async (i: Message): Promise<Message | KyResponse> => {
                  const message: Message = i;
                  return await ky
                    .post(Secrets.DISPATCH_URL, {
                      json: {
                        event_type: "download",
                        client_payload: {
                          commandType: "dl",
                          link: `${content}`,
                          channel: `${message.channelId}`,
                          message: `${message.id}`,
                          token: `${interaction.token}`,
                          startTime: new Date().getTime().toString(),
                        },
                      },
                      headers: {
                        Authorization: `token ${Secrets.GITHUB_TOKEN}`,
                        Accept: "application/vnd.github.everest-preview+json",
                      },
                    })
                    .catch(
                      async (e: Error): Promise<Message> =>
                        await b.helpers.editFollowupMessage(
                          interaction.token,
                          message.id,
                          Messages.createErrorMessage({
                            link: contents.join("\n"),
                            description: e.message,
                          })
                        )
                    );
                })
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
