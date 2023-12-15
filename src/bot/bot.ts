import ky, { KyResponse } from "ky";
import { Secrets, isUrl } from "@libs";
import { Commands } from "@bot/commands.ts";
import {
  Bot,
  createBot,
  Intents,
  Interaction,
  InteractionResponseTypes,
  Message,
} from "discordeno";

const bot = createBot({
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
          data: {
            content: `**⚠️Error**\n${contents.join("\n")}`,
          },
        });
      } else {
        await Promise.all(
          contents.map(
            async (content: string): Promise<Message | KyResponse> =>
              await b.helpers
                .sendFollowupMessage(interaction.token, {
                  type: InteractionResponseTypes.ChannelMessageWithSource,
                  data: {
                    content: `**⏳Starting...**\n${contents.join("\n")}`,
                  },
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
                      async (): Promise<Message> =>
                        await b.helpers.editMessage(
                          message.channelId,
                          message.id,
                          {
                            content: `**⚠️Error**\n${contents.join("\n")}`,
                          }
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
