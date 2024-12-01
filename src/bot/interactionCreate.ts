import { If } from "functional";
import { KyResponse } from "ky";
import { Messages, webhook, isUrl } from "@libs";
import {
  Bot,
  Interaction,
  InteractionResponseTypes,
  Message,
} from "discordeno";

/**
 * Handles the interactionCreate event for the bot.
 *
 * @param {Bot} b - The bot instance.
 * @param {Exclude<Pick<Interaction, "data">["data"], undefined>} data - The interaction data object.
 * @param {Interaction} interaction - The interaction object.
 * @param {string} commandType - The type of command, whether dl or threaddl.
 * @return {Promise<void>} A promise that resolves when the function completes.
 */
export const interactionCreate = async (props: {
  b: Bot;
  data: Exclude<Pick<Interaction, "data">["data"], undefined>;
  interaction: Interaction;
  commandType: string;
}): Promise<void> => {
  const contents: string[] = props.data.options
    ?.map((i) => i.value as string)
    .join("")
    .split(" ") as string[];
  await props.b.helpers.sendInteractionResponse(
    props.interaction.id,
    props.interaction.token,
    {
      type: InteractionResponseTypes.DeferredChannelMessageWithSource,
    }
  );
  If(
    !contents.every((i: string): boolean => isUrl(i)),
    async (): Promise<void> => {
      await props.b.helpers.sendFollowupMessage(props.interaction.token, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: Messages.createErrorMessage({
          description: contents.join("\n"),
        }),
      });
    }
  ).else(async (): Promise<void> => {
    await Promise.all(
      contents.map(
        async (content: string): Promise<Message | KyResponse> =>
          await props.b.helpers
            .sendFollowupMessage(props.interaction.token, {
              type: InteractionResponseTypes.ChannelMessageWithSource,
              data: Messages.createProgressMessage({
                content: `**🕑Queuing...**`,
                link: content,
              }),
            })
            .then(
              async (i: Message): Promise<Message | KyResponse> =>
                await webhook({
                  commandType: props.commandType,
                  content: content,
                  channelId: i.channelId,
                  id: i.id,
                  token: props.interaction.token,
                }).catch(
                  async (e: Error): Promise<Message> =>
                    await props.b.helpers.editFollowupMessage(
                      props.interaction.token,
                      i.id,
                      Messages.createErrorMessage({
                        link: content,
                        description: e.message,
                      })
                    )
                )
            )
      )
    );
  });
};
