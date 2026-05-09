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

/**
 * Pure "do the thread thing" flow shared by:
 * - the legacy `/threaddl` ApplicationCommand path (kept for reference; the
 *   live entry point is now Modal-based, see `threadInteractionCreate.ts`)
 * - the new ModalSubmit path that fires after the user pastes URLs into the
 *   Discord Modal (see `threadModalSubmit.ts`)
 *
 * Inputs:
 * - `interaction`: the interaction whose token we use for the followup
 *   (Defer + followup message). For Modal flows this is the **ModalSubmit
 *   interaction**, not the original ApplicationCommand.
 * - `commandType`: `"threaddl"` or `"threaddl-spoiler"` — forwarded into the
 *   `repository_dispatch` payload so the bot's callback router can route
 *   spoiler vs. non-spoiler accordingly.
 * - `threadName`: title for the thread that gets created.
 * - `contents`: the pre-extracted list of URL strings (already validated by
 *   the caller — no further parsing is done here).
 *
 * Side effects:
 * 1. ACK the interaction (DeferredChannelMessageWithSource).
 * 2. If validation fails (no URLs, invalid URL, missing thread context),
 *    post an error followup and return.
 * 3. Otherwise create a Discord thread, post one "Queuing" message per URL
 *    inside the thread, and fire a single `repository_dispatch` (event_type
 *    = `thread-download`) with the `links` array so the GitHub Actions
 *    matrix workflow can fan-out per-URL processing in parallel.
 *
 * @param props - Flow inputs.
 * @returns A promise that resolves when the fan-out is dispatched.
 */
export const runThreadFlow = async (props: {
  b: Bot;
  interaction: Interaction;
  commandType: string;
  threadName: string;
  contents: string[];
}): Promise<void> => {
  await props.b.helpers.sendInteractionResponse(
    props.interaction.id,
    props.interaction.token,
    {
      type: InteractionResponseTypes.DeferredChannelMessageWithSource,
    },
  );

  const allValid: boolean =
    props.contents.length > 0 &&
    props.contents.every((i: string): boolean => isUrl(i)) &&
    props.threadName.length > 0;

  await If(
    !allValid,
    async (): Promise<void> => {
      await props.b.helpers.sendFollowupMessage(props.interaction.token, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: Messages.createErrorMessage({
          description:
            props.contents.length > 0
              ? props.contents.join("\n")
              : "No valid URL was found in the input.",
        }),
      });
    },
  ).else(async (): Promise<void> => {
    // Threads can only be created inside a guild text/announcement/forum
    // channel. `interaction.channelId` is populated for DM interactions too
    // (it's the DM channel ID), so also gate on `guildId` to ensure we are
    // running in a guild context before calling `startThreadWithoutMessage`.
    //
    // NOTE: `/threaddl` and `/threaddl-spoiler` are registered with
    // `dmPermission: false` so Discord clients should never surface them in
    // DMs. This guard is kept as a defensive measure against stale client-side
    // command caches — Discord propagates command updates within ~1 hour, so a
    // small window exists where users may still see the old definition.
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
        name: props.threadName,
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
        content: `🧵 Created thread <#${thread.id}> for ${props.contents.length} URL(s).`,
      },
    });

    const queueResults = await Promise.all(
      props.contents.map(
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
