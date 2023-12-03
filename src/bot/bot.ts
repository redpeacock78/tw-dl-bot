import ky, { KyResponse } from "ky";
import { Secrets } from "@libs/secrets.ts";
import { Commands } from "@bot/commands.ts";
import {
  createBot,
  Intents,
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

bot.events.interactionCreate = async (b, interaction) => {
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
                        link: `${content}`,
                        channel: `${message.channelId}`,
                        message: `${message.id}`,
                        token: `${interaction.token}`,
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
      break;
    }
    default: {
      break;
    }
  }
};

export default bot;
