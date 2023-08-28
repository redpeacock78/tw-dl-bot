import ky from "ky";
import { Secrets } from "@libs/secrets.ts";
import {
  createBot,
  Intents,
  CreateSlashApplicationCommand,
  InteractionResponseTypes,
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

const dlCommand: CreateSlashApplicationCommand = {
  name: "dl",
  description: "Download tweet video",
  type: 1,
  options: [
    {
      name: "url",
      type: 3,
      required: true,
      description: "Tweet URL",
    },
  ],
};

await bot.helpers.createGlobalApplicationCommand(dlCommand);

bot.events.messageCreate = async (b, message): Promise<void> => {
  if (message.isFromBot) return;
  if (message.content.match(/^!dl /)) {
    const contents: string[] = message.content.replace(/^!dl /, "").split(" ");
    for (const content of contents) {
      await ky
        .post(Secrets.DISPATCH_URL, {
          json: {
            event_type: "download",
            client_payload: {
              link: `${content}`,
              channel: `${message.channelId}`,
              message: `${message.id}`,
            },
          },
          headers: {
            Authorization: `token ${Secrets.GITHUB_TOKEN}`,
            Accept: "application/vnd.github.everest-preview+json",
          },
        })
        .then(() =>
          b.helpers.sendMessage(message.channelId, {
            content: `⏳Starting...\n${content}`,
            messageReference: {
              messageId: message.id,
              failIfNotExists: true,
            },
          })
        )
        .catch(() =>
          b.helpers.sendMessage(message.channelId, {
            content: `⚠️Error\n${content}`,
            messageReference: {
              messageId: message.id,
              failIfNotExists: true,
            },
          })
        );
    }
  }
};

bot.events.interactionCreate = async (b, interaction) => {
  switch (interaction.data?.name) {
    case "dl": {
      const contents = interaction.data.options
        ?.map((i) => i.value)
        .join("")
        .split(" ") as string[];
      for (const content of contents) {
        await ky
          .post(Secrets.DISPATCH_URL, {
            json: {
              event_type: "download",
              client_payload: {
                link: `${content}`,
                channel: `${interaction.token}`,
                message: `${interaction.id}`,
              },
            },
            headers: {
              Authorization: `token ${Secrets.GITHUB_TOKEN}`,
              Accept: "application/vnd.github.everest-preview+json",
            },
          })
          .then(() =>
            b.helpers.sendInteractionResponse(
              interaction.id,
              interaction.token,
              {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                  content: `⏳Starting...\n${content}`,
                },
              }
            )
          )
          .catch(() =>
            b.helpers.sendInteractionResponse(
              interaction.id,
              interaction.token,
              {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                  content: `⚠️Error\n${content}`,
                },
              }
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
