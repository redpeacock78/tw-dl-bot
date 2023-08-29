import ky from "ky";
import { Secrets } from "@libs/secrets.ts";
import { Commands } from "@bot/commands.ts";
import { createBot, Intents, InteractionResponseTypes } from "discordeno";

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
      await Promise.all(
        contents.map(
          async (content: string) =>
            await ky.post(Secrets.DISPATCH_URL, {
              json: {
                event_type: "download",
                client_payload: {
                  link: `${content}`,
                  channel: `${interaction.channelId}`,
                  message: `${interaction.id}`,
                  token: `${interaction.token}`,
                },
              },
              headers: {
                Authorization: `token ${Secrets.GITHUB_TOKEN}`,
                Accept: "application/vnd.github.everest-preview+json",
              },
            })
        )
      )
        .then(
          (): Promise<void> =>
            b.helpers.sendInteractionResponse(
              interaction.id,
              interaction.token,
              {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                  content: `⏳Starting...\n${contents.join("\n")}`,
                },
              }
            )
        )
        .catch(
          (): Promise<void> =>
            b.helpers.sendInteractionResponse(
              interaction.id,
              interaction.token,
              {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                  content: `⚠️Error\n${contents.join("\n")}`,
                },
              }
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
