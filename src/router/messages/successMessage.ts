import bot from "@bot/bot.ts";
import { Match } from "functional";
import { Message } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type SingleSuccsessMessageObject =
  CreateMessageTypes.SendSuccessMessage.singleFileObject | null;
type MultiSuccsessMessageObject =
  CreateMessageTypes.SendSuccessMessage.multiFilesObject | null;

const trueOversize = Constants.CallbackObject.Oversize.TRUE;
const editFollowupMessageTimeLimit = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;

const successMessage = {
  /**
   * Asynchronously handles a single success message and sends it based on conditions.
   *
   * @param {SingleSuccsessMessageObject} singleSuccsessMessageObject - The object containing the single success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  singleFile: (
    singleSuccsessMessageObject: SingleSuccsessMessageObject
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(singleSuccsessMessageObject!.startTime);
    const isEditFollowupMessage: boolean =
      runTime <= editFollowupMessageTimeLimit ||
      singleSuccsessMessageObject!.oversize !== trueOversize;
    return Match(isEditFollowupMessage)
      .with(
        true,
        async (): Promise<Message> =>
          await bot.helpers
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
              })
            )
            .finally((): null => (singleSuccsessMessageObject = null))
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
              })
            )
            .finally((): null => (singleSuccsessMessageObject = null))
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
    multiSuccsessMessageObject: MultiSuccsessMessageObject
  ): Promise<Message> => {
    const runTime: number =
      new Date().getTime() - Number(multiSuccsessMessageObject!.startTime);
    const editFollowupMessageFlag: boolean =
      runTime <= editFollowupMessageTimeLimit ||
      multiSuccsessMessageObject!.oversize !== trueOversize;
    return Match(editFollowupMessageFlag)
      .with(
        true,
        async (): Promise<Message> =>
          await bot.helpers
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
              })
            )
            .finally((): null => (multiSuccsessMessageObject = null))
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
              })
            )
            .finally((): null => (multiSuccsessMessageObject = null))
      )
      .exhaustive();
  },
};

export default successMessage;
