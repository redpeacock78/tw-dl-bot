import bot from "@bot/bot.ts";
import { Match } from "functional";
import { Message, Embed } from "discordeno";
import type { FileContent, CreateMessage } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type SingleSuccsessMessageObject =
  CreateMessageTypes.SendSuccessMessage.singleFileObject | null;
type MultiSuccsessMessageObject =
  CreateMessageTypes.SendSuccessMessage.multiFilesObject | null;

const trueOversize = Constants.CallbackObject.Oversize.TRUE;
const editFollowupMessageTimeLimit = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;

/**
 * Edits a thread placeholder message with an embed and file attachments via
 * direct multipart PATCH.
 *
 * **Why not `bot.helpers.editMessage`?**
 * discordeno v18's `editMessage` helper builds the multipart body in
 * `createRequestBody.ts` as:
 * ```
 * form.append("payload_json", JSON.stringify({ ...body, file: undefined }));
 * ```
 * It spreads the body but does **not** inject an `attachments` array.
 * Discord's PATCH /channels/{id}/messages/{id} endpoint (updated 2022)
 * requires new file attachments to be referenced by zero-based index in
 * `payload_json.attachments`; without this, file data arrives at Discord
 * but is silently discarded.
 *
 * This function calls `bot.rest.runMethod` directly so we can add the
 * correct `attachments: [{id: N, filename}]` entries.  If a future
 * discordeno release fixes the upstream behaviour, revert to
 * `bot.helpers.editMessage`.
 */
async function editThreadMessageWithFiles(
  channelId: bigint | string,
  messageId: bigint | string,
  content: string | null | undefined,
  embeds: Embed[],
  files: FileContent[],
): Promise<Message> {
  const result = await bot.rest.runMethod<Record<string, unknown>>(
    bot.rest,
    "PATCH",
    bot.constants.routes.CHANNEL_MESSAGE(channelId, messageId),
    {
      content,
      embeds: embeds.map((e) => bot.transformers.reverse.embed(bot, e)),
      file: files.length === 1 ? files[0] : files,
      // Discord API (2022+): multipart PATCH requires `attachments[].id` in
      // payload_json to reference each uploaded file by its zero-based index
      // in the `files[N]` parts.  Without this, Discord ignores the files.
      attachments: files.map((f, i) => ({ id: i, filename: f.name })),
    },
  );
  // Callers chain .then()/.catch() on the Promise but never use the Message
  // value directly, so casting the raw response is safe here.
  return result as unknown as Message;
}

const successMessage = {
  /**
   * Asynchronously handles a single success message and sends it based on conditions.
   *
   * @param {SingleSuccsessMessageObject} singleSuccsessMessageObject - The object containing the single success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  singleFile: (
    singleSuccsessMessageObject: SingleSuccsessMessageObject,
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(singleSuccsessMessageObject!.startTime);
    const useThread: boolean = !!singleSuccsessMessageObject!.useThread;
    // editMessage (thread mode) is not bound by the 15-min interaction-token
    // window or the followup oversize fallback, so always edit the
    // placeholder when running in a thread.
    const isEditOriginalMessage: boolean =
      useThread ||
      runTime <= editFollowupMessageTimeLimit ||
      singleSuccsessMessageObject!.oversize !== trueOversize;
    return Match(isEditOriginalMessage)
      .with(
        true,
        async (): Promise<Message> => {
          if (useThread) {
            // Thread mode: use manual multipart PATCH to include `attachments`
            // in payload_json (discordeno v18 omits this — see JSDoc above).
            const msgPayload = Messages.createSuccessMessage({
              runNumber: singleSuccsessMessageObject!.runNumber,
              runTime: runTime,
              totalSize: singleSuccsessMessageObject!.totalSize,
              fileName: singleSuccsessMessageObject!.fileName,
              link: singleSuccsessMessageObject!.link,
              file: singleSuccsessMessageObject!.file,
              spoiler: singleSuccsessMessageObject!.spoiler,
            }) as CreateMessage;
            const rawFile = msgPayload.file;
            const files: FileContent[] = !rawFile
              ? []
              : Array.isArray(rawFile)
              ? (rawFile as FileContent[])
              : [rawFile as FileContent];
            return editThreadMessageWithFiles(
              singleSuccsessMessageObject!.channelId,
              singleSuccsessMessageObject!.messageId,
              msgPayload.content,
              (msgPayload.embeds ?? []) as Embed[],
              files,
            ).finally((): null => (singleSuccsessMessageObject = null));
          }
          return await bot.helpers
            .editFollowupMessage(
              singleSuccsessMessageObject!.token,
              singleSuccsessMessageObject!.messageId,
              Messages.createSuccessMessage({
                runNumber: singleSuccsessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: singleSuccsessMessageObject!.totalSize,
                fileName: singleSuccsessMessageObject!.fileName,
                link: singleSuccsessMessageObject!.link,
                file: singleSuccsessMessageObject!.file,
                spoiler: singleSuccsessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (singleSuccsessMessageObject = null));
        },
      )
      .with(
        false,
        async (): Promise<Message> =>
          await bot.helpers
            .sendMessage(
              singleSuccsessMessageObject!.channelId,
              Messages.createSuccessMessage({
                messageId: singleSuccsessMessageObject!.messageId,
                channelId: singleSuccsessMessageObject!.channelId,
                runNumber: singleSuccsessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: singleSuccsessMessageObject!.totalSize,
                fileName: singleSuccsessMessageObject!.fileName,
                link: singleSuccsessMessageObject!.link,
                file: singleSuccsessMessageObject!.file,
                spoiler: singleSuccsessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (singleSuccsessMessageObject = null)),
      )
      .exhaustive();
  },
  /**
   * Asynchronously handles multiple success messages and sends them based on conditions.
   *
   * @param {MultiSuccsessMessageObject} multiSuccsessMessageObject - The object containing the multiple success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  multiFiles: (
    multiSuccsessMessageObject: MultiSuccsessMessageObject,
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(multiSuccsessMessageObject!.startTime);
    const useThread: boolean = !!multiSuccsessMessageObject!.useThread;
    // editMessage (thread mode) is not bound by the 15-min interaction-token
    // window or the followup oversize fallback, so always edit the
    // placeholder when running in a thread.
    const isEditOriginalMessage: boolean =
      useThread ||
      runTime <= editFollowupMessageTimeLimit ||
      multiSuccsessMessageObject!.oversize !== trueOversize;
    return Match(isEditOriginalMessage)
      .with(
        true,
        async (): Promise<Message> => {
          if (useThread) {
            // Thread mode: use manual multipart PATCH to include `attachments`
            // in payload_json (discordeno v18 omits this — see JSDoc above).
            const msgPayload = Messages.createSuccessMessage({
              runNumber: multiSuccsessMessageObject!.runNumber,
              runTime: runTime,
              totalSize: multiSuccsessMessageObject!.totalSize,
              fileNamesArray: multiSuccsessMessageObject!.fileNamesArray,
              link: multiSuccsessMessageObject!.link,
              filesArray: multiSuccsessMessageObject!.filesArray,
              spoiler: multiSuccsessMessageObject!.spoiler,
            }) as CreateMessage;
            const rawFile = msgPayload.file;
            const files: FileContent[] = !rawFile
              ? []
              : Array.isArray(rawFile)
              ? (rawFile as FileContent[])
              : [rawFile as FileContent];
            return editThreadMessageWithFiles(
              multiSuccsessMessageObject!.channelId,
              multiSuccsessMessageObject!.messageId,
              msgPayload.content,
              (msgPayload.embeds ?? []) as Embed[],
              files,
            ).finally((): null => (multiSuccsessMessageObject = null));
          }
          return await bot.helpers
            .editFollowupMessage(
              multiSuccsessMessageObject!.token,
              multiSuccsessMessageObject!.messageId,
              Messages.createSuccessMessage({
                runNumber: multiSuccsessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: multiSuccsessMessageObject!.totalSize,
                fileNamesArray: multiSuccsessMessageObject!.fileNamesArray,
                link: multiSuccsessMessageObject!.link,
                filesArray: multiSuccsessMessageObject!.filesArray,
                spoiler: multiSuccsessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (multiSuccsessMessageObject = null));
        },
      )
      .with(
        false,
        async (): Promise<Message> =>
          await bot.helpers
            .sendMessage(
              multiSuccsessMessageObject!.channelId,
              Messages.createSuccessMessage({
                messageId: multiSuccsessMessageObject!.messageId,
                channelId: multiSuccsessMessageObject!.channelId,
                runNumber: multiSuccsessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: multiSuccsessMessageObject!.totalSize,
                fileNamesArray: multiSuccsessMessageObject!.fileNamesArray,
                link: multiSuccsessMessageObject!.link,
                filesArray: multiSuccsessMessageObject!.filesArray,
                spoiler: multiSuccsessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (multiSuccsessMessageObject = null)),
      )
      .exhaustive();
  },
};

export default successMessage;
