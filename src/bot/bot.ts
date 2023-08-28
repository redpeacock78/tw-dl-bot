import ky from "ky";
import { Secrets } from "@libs/secrets.ts";
import { createBot, Intents } from "discordeno";

const bot = createBot({
  token: Secrets.DISCORD_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
  events: {
    ready: (_bot, payload) => {
      console.log(`${payload.user.username} is ready!`);
    },
  },
});

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

export default bot;
