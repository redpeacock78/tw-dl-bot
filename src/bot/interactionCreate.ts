import { KyResponse } from "ky";
import { Messages, webhook, isUrl } from "@libs";
import {
  Bot,
  Interaction,
  InteractionResponseTypes,
  Message,
} from "discordeno";

export const interactionCreate = async (
  b: Bot,
  interaction: Interaction,
  commandType: string
) => {
  const contents: string[] = interaction
    .data!.options?.map((i) => i.value)
    .join("")
    .split(" ") as string[];
  await b.helpers.sendInteractionResponse(interaction.id, interaction.token, {
    type: InteractionResponseTypes.DeferredChannelMessageWithSource,
  });
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
                  commandType: commandType,
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
};
