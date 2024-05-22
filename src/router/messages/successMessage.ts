import bot from "@bot/bot.ts";
import { match } from "ts-pattern";
import { Message } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const successMessage = {
  /**
   * Asynchronously handles a single success message and sends it based on conditions.
   *
   * @param {CreateMessageTypes.SendSuccessMessage.singleFileObject | null} singleSuccsessMessageObject - The object containing the single success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  singleFile: (
    singleSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.singleFileObject | null
  ): Promise<Message> => {
    try {
      const runTime: number =
        new Date().getTime() - Number(singleSuccsessMessageObject!.startTime);
      const isEditFollowupMessage: boolean =
        runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
        singleSuccsessMessageObject!.oversize !==
          Constants.CallbackObject.Oversize.TRUE;
      return match(isEditFollowupMessage)
        .with(
          true,
          async (): Promise<Message> =>
            await bot.helpers.editFollowupMessage(
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
        )
        .with(
          false,
          async (): Promise<Message> =>
            await bot.helpers.sendMessage(
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
        )
        .exhaustive();
    } finally {
      singleSuccsessMessageObject = null;
    }
  },
  /**
   * Asynchronously handles multiple success messages and sends them based on conditions.
   *
   * @param {CreateMessageTypes.SendSuccessMessage.multiFilesObject | null} multiSuccsessMessageObject - The object containing the multiple success message details.
   * @return {Promise<Message>} A promise that resolves to a message response.
   */
  multiFiles: (
    multiSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.multiFilesObject | null
  ): Promise<Message> => {
    try {
      const runTime: number =
        new Date().getTime() - Number(multiSuccsessMessageObject!.startTime);
      const editFollowupMessageFlag: boolean =
        runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
        multiSuccsessMessageObject!.oversize !==
          Constants.CallbackObject.Oversize.TRUE;
      return match(editFollowupMessageFlag)
        .with(
          true,
          async (): Promise<Message> =>
            await bot.helpers.editFollowupMessage(
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
        )
        .with(
          false,
          async (): Promise<Message> =>
            await bot.helpers.sendMessage(
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
        )
        .exhaustive();
    } finally {
      multiSuccsessMessageObject = null;
    }
  },
};

export default successMessage;
