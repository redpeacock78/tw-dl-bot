import { If } from "functional";
import { KyResponse } from "ky";
import {
  Bot,
  ChannelTypes,
  EditMessage,
  Interaction,
  InteractionResponseTypes,
  Message,
} from "discordeno";
import { Messages, Constants, isUrl, webhookThread } from "@libs";

type InteractionData = Exclude<Pick<Interaction, "data">["data"], undefined>;
type InteractionOption = Exclude<
  Pick<InteractionData, "options">["options"],
  undefined
>[number];

const NAME_OPTION = "name";
const URL_OPTION = "url";

/**
 * Resolves a string-typed option from the interaction data by name.
 *
 * @param {InteractionOption[] | undefined} options - The options array of the interaction.
 * @param {string} name - The name of the option to extract.
 * @return {string} The string value of the matched option, or empty string if not found.
 */
const pickOption = (
  options: InteractionOption[] | undefined,
  name: string,
): string =>
  (options ?? []).find(
    (i: InteractionOption): boolean => i.name === name,
  )?.value as string ?? "";

/**
 * Handles the `/threaddl` interaction by creating a Discord thread on the
 * source channel, queueing one message per URL inside the thread, and firing
 * a single `repository_dispatch` (event_type=`thread-download`) so the
 * GitHub Actions matrix workflow can fan-out per-URL processing in parallel.
 *
 * @param {object} props - The handler props bag.
 * @param {Bot} props.b - The bot instance.
 * @param {InteractionData} props.data - The interaction data object.
 * @param {Interaction} props.interaction - The interaction object.
 * @param {string} props.commandType - The command type (`threaddl`).
 * @return {Promise<void>} A promise that resolves when fan-out completes.
 */
export const threadInteractionCreate = async (props: {
  b: Bot;
  data: InteractionData;
  interaction: Interaction;
  commandType: string;
}): Promise<void> => {
  const threadName: string = pickOption(props.data.options, NAME_OPTION);
  const rawUrl: string = pickOption(props.data.options, URL_OPTION);
  const contents: string[] = rawUrl.split(" ").filter((i: string): boolean =>
    i.length > 0,
  );

  await props.b.helpers.sendInteractionResponse(
    props.interaction.id,
    props.interaction.token,
    {
      type: InteractionResponseTypes.DeferredChannelMessageWithSource,
    },
  );

  const allValid: boolean =
    contents.length > 0 &&
    contents.every((i: string): boolean => isUrl(i)) &&
    threadName.length > 0;

  await If(
    !allValid,
    async (): Promise<void> => {
      await props.b.helpers.sendFollowupMessage(props.interaction.token, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: Messages.createErrorMessage({
          description: contents.length > 0 ? contents.join("\n") : rawUrl,
        }),
      });
    },
  ).else(async (): Promise<void> => {
    // Threads can only be created inside a guild text/announcement/forum
    // channel. `interaction.channelId` is populated for DM interactions too
    // (it's the DM channel ID), so also gate on `guildId` to ensure we are
    // running in a guild context before calling `startThreadWithoutMessage`.
    if (!props.interaction.channelId || !props.interaction.guildId) {
      await props.b.helpers.sendFollowupMessage(props.interaction.token, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: Messages.createErrorMessage({
          description: "This command must be used in a guild text channel.",
        }),
      });
      return;
    }

    const thread = await props.b.helpers
      .startThreadWithoutMessage(props.interaction.channelId, {
        name: threadName,
        autoArchiveDuration: Constants.Thread.AUTO_ARCHIVE_DURATION,
        type: Constants.Thread.TYPE as ChannelTypes.PublicThread,
      })
      .catch(async (e: Error): Promise<null> => {
        await props.b.helpers.sendFollowupMessage(props.interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: Messages.createErrorMessage({
            description: `Failed to create thread: ${e.message}`,
          }),
        });
        return null;
      });
    if (!thread) return;

    await props.b.helpers.sendFollowupMessage(props.interaction.token, {
      type: InteractionResponseTypes.ChannelMessageWithSource,
      data: {
        content: `🧵 Created thread <#${thread.id}> for ${contents.length} URL(s).`,
      },
    });

    const queueResults = await Promise.all(
      contents.map(
        async (
          content: string,
        ): Promise<{ link: string; message: string } | null> =>
          await props.b.helpers
            .sendMessage(
              thread.id,
              Messages.createProgressMessage({
                content: `**🕑Queuing...**`,
                link: content,
              }),
            )
            .then((m: Message): { link: string; message: string } => ({
              link: content,
              message: `${m.id}`,
            }))
            .catch((): null => null),
      ),
    );
    const links = queueResults.filter(
      (i): i is { link: string; message: string } => i !== null,
    );
    if (links.length === 0) return;

    await webhookThread({
      commandType: props.commandType,
      links,
      channelId: thread.id,
      token: props.interaction.token,
      startTime: new Date().getTime().toString(),
    }).catch(async (e: Error): Promise<KyResponse | void> => {
      await Promise.all(
        links.map(
          async (i: { link: string; message: string }): Promise<Message> =>
            await props.b.helpers.editMessage(
              thread.id,
              BigInt(i.message),
              Messages.createErrorMessage({
                link: i.link,
                description: e.message,
              }) as EditMessage,
            ),
        ),
      );
    });
  });
};
