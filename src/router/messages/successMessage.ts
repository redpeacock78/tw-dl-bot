import bot from "@bot/bot.ts";
import { Match } from "functional";
import { Message, Embed } from "discordeno";
import type { FileContent, CreateMessage } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type SingleSuccessMessageObject =
  CreateMessageTypes.SendSuccessMessage.singleFileObject | null;
type MultiSuccessMessageObject =
  CreateMessageTypes.SendSuccessMessage.multiFilesObject | null;

const trueOversize = Constants.CallbackObject.Oversize.TRUE;
const editFollowupMessageTimeLimit = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;

/**
 * Edits a thread placeholder message with an embed and file attachments via
 * direct multipart PATCH using `fetch`.
 *
 * **Why not `bot.helpers.editMessage` or `bot.rest.runMethod`?**
 * discordeno v18's `createRequestBody.ts` names each multipart file part as
 * `file${i}` (e.g. `file0`, `file1`).  Discord's PATCH
 * /channels/{id}/messages/{id} endpoint (updated 2022) requires the
 * bracket-notation `files[0]`, `files[1]`, ... so the server can match each
 * part to its `payload_json.attachments[].id` reference.  The name mismatch
 * causes Discord to return a 4xx, which propagates back as a 500 from the
 * Hono callback endpoint.
 *
 * Calling `fetch` directly lets us build the FormData with the correct field
 * names.  If a future discordeno release fixes the naming, revert to
 * `bot.helpers.editMessage`.
 */
async function editThreadMessageWithFiles(
  channelId: bigint | string,
  messageId: bigint | string,
  content: string | null | undefined,
  embeds: Embed[],
  files: FileContent[],
): Promise<Message> {
  const form = new FormData();
  // Use `files[N]` bracket notation — required by Discord's PATCH attachment API.
  files.forEach((f, i) => form.append(`files[${i}]`, f.blob, f.name));
  form.append(
    "payload_json",
    JSON.stringify({
      content,
      embeds: embeds.map((e) => bot.transformers.reverse.embed(bot, e)),
      // Each attachment entry maps the zero-based index to the corresponding
      // `files[N]` part so Discord links the uploaded file to the message.
      attachments: files.map((f, i) => ({ id: i, filename: f.name })),
    }),
  );
  const response = await fetch(
    `${Constants.DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bot ${bot.token}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after") ?? "unknown";
    throw new Error(
      `Discord editMessage rate limited; retry-after=${retryAfter}s`,
    );
  }
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({})) as Record<string, unknown>;
    throw new Error(
      `Discord editMessage PATCH ${response.status}: ${JSON.stringify(err)}`,
    );
  }
  // Callers chain .then()/.catch() on the returned Promise but never use the
  // Message value directly, so an empty cast is safe here.
  return {} as unknown as Message;
}

const successMessage = {
  /**
   * Asynchronously handles a single success message and sends it based on conditions.
   *
   * @param {SingleSuccessMessageObject} singleSuccessMessageObject - The object containing the single success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  singleFile: (
    singleSuccessMessageObject: SingleSuccessMessageObject,
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(singleSuccessMessageObject!.startTime);
    const useThread: boolean = !!singleSuccessMessageObject!.useThread;
    // editMessage (thread mode) is not bound by the 15-min interaction-token
    // window or the followup oversize fallback, so always edit the
    // placeholder when running in a thread.
    const isEditOriginalMessage: boolean =
      useThread ||
      runTime <= editFollowupMessageTimeLimit ||
      singleSuccessMessageObject!.oversize !== trueOversize;
    return Match(isEditOriginalMessage)
      .with(
        true,
        async (): Promise<Message> => {
          if (useThread) {
            // Thread mode: use manual multipart PATCH to include `attachments`
            // in payload_json (discordeno v18 omits this — see JSDoc above).
            const msgPayload = Messages.createSuccessMessage({
              runNumber: singleSuccessMessageObject!.runNumber,
              runTime: runTime,
              totalSize: singleSuccessMessageObject!.totalSize,
              fileName: singleSuccessMessageObject!.fileName,
              link: singleSuccessMessageObject!.link,
              file: singleSuccessMessageObject!.file,
              spoiler: singleSuccessMessageObject!.spoiler,
            }) as CreateMessage;
            const rawFile = msgPayload.file;
            const files: FileContent[] = !rawFile
              ? []
              : Array.isArray(rawFile)
              ? (rawFile as FileContent[])
              : [rawFile as FileContent];
            return editThreadMessageWithFiles(
              singleSuccessMessageObject!.channelId,
              singleSuccessMessageObject!.messageId,
              msgPayload.content,
              (msgPayload.embeds ?? []) as Embed[],
              files,
            ).finally((): null => (singleSuccessMessageObject = null));
          }
          return await bot.helpers
            .editFollowupMessage(
              singleSuccessMessageObject!.token,
              singleSuccessMessageObject!.messageId,
              Messages.createSuccessMessage({
                runNumber: singleSuccessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: singleSuccessMessageObject!.totalSize,
                fileName: singleSuccessMessageObject!.fileName,
                link: singleSuccessMessageObject!.link,
                file: singleSuccessMessageObject!.file,
                spoiler: singleSuccessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (singleSuccessMessageObject = null));
        },
      )
      .with(
        false,
        async (): Promise<Message> =>
          await bot.helpers
            .sendMessage(
              singleSuccessMessageObject!.channelId,
              Messages.createSuccessMessage({
                messageId: singleSuccessMessageObject!.messageId,
                channelId: singleSuccessMessageObject!.channelId,
                runNumber: singleSuccessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: singleSuccessMessageObject!.totalSize,
                fileName: singleSuccessMessageObject!.fileName,
                link: singleSuccessMessageObject!.link,
                file: singleSuccessMessageObject!.file,
                spoiler: singleSuccessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (singleSuccessMessageObject = null)),
      )
      .exhaustive();
  },
  /**
   * Asynchronously handles multiple success messages and sends them based on conditions.
   *
   * @param {MultiSuccessMessageObject} multiSuccessMessageObject - The object containing the multiple success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  multiFiles: (
    multiSuccessMessageObject: MultiSuccessMessageObject,
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(multiSuccessMessageObject!.startTime);
    const useThread: boolean = !!multiSuccessMessageObject!.useThread;
    // editMessage (thread mode) is not bound by the 15-min interaction-token
    // window or the followup oversize fallback, so always edit the
    // placeholder when running in a thread.
    const isEditOriginalMessage: boolean =
      useThread ||
      runTime <= editFollowupMessageTimeLimit ||
      multiSuccessMessageObject!.oversize !== trueOversize;
    return Match(isEditOriginalMessage)
      .with(
        true,
        async (): Promise<Message> => {
          if (useThread) {
            // Thread mode: use manual multipart PATCH to include `attachments`
            // in payload_json (discordeno v18 omits this — see JSDoc above).
            const msgPayload = Messages.createSuccessMessage({
              runNumber: multiSuccessMessageObject!.runNumber,
              runTime: runTime,
              totalSize: multiSuccessMessageObject!.totalSize,
              fileNamesArray: multiSuccessMessageObject!.fileNamesArray,
              link: multiSuccessMessageObject!.link,
              filesArray: multiSuccessMessageObject!.filesArray,
              spoiler: multiSuccessMessageObject!.spoiler,
            }) as CreateMessage;
            const rawFile = msgPayload.file;
            const files: FileContent[] = !rawFile
              ? []
              : Array.isArray(rawFile)
              ? (rawFile as FileContent[])
              : [rawFile as FileContent];
            return editThreadMessageWithFiles(
              multiSuccessMessageObject!.channelId,
              multiSuccessMessageObject!.messageId,
              msgPayload.content,
              (msgPayload.embeds ?? []) as Embed[],
              files,
            ).finally((): null => (multiSuccessMessageObject = null));
          }
          return await bot.helpers
            .editFollowupMessage(
              multiSuccessMessageObject!.token,
              multiSuccessMessageObject!.messageId,
              Messages.createSuccessMessage({
                runNumber: multiSuccessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: multiSuccessMessageObject!.totalSize,
                fileNamesArray: multiSuccessMessageObject!.fileNamesArray,
                link: multiSuccessMessageObject!.link,
                filesArray: multiSuccessMessageObject!.filesArray,
                spoiler: multiSuccessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (multiSuccessMessageObject = null));
        },
      )
      .with(
        false,
        async (): Promise<Message> =>
          await bot.helpers
            .sendMessage(
              multiSuccessMessageObject!.channelId,
              Messages.createSuccessMessage({
                messageId: multiSuccessMessageObject!.messageId,
                channelId: multiSuccessMessageObject!.channelId,
                runNumber: multiSuccessMessageObject!.runNumber,
                runTime: runTime,
                totalSize: multiSuccessMessageObject!.totalSize,
                fileNamesArray: multiSuccessMessageObject!.fileNamesArray,
                link: multiSuccessMessageObject!.link,
                filesArray: multiSuccessMessageObject!.filesArray,
                spoiler: multiSuccessMessageObject!.spoiler,
              }),
            )
            .finally((): null => (multiSuccessMessageObject = null)),
      )
      .exhaustive();
  },
};

export default successMessage;
