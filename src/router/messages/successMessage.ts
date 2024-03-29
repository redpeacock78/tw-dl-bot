import bot from "@bot/bot.ts";
import { Message } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const successMessage = {
  singleFile: async (
    singleSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.singleFileObject | null
  ): Promise<Message> => {
    try {
      const runTime: number =
        new Date().getTime() - Number(singleSuccsessMessageObject!.startTime);
      const editFollowupMessageFlag: boolean =
        runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
        singleSuccsessMessageObject!.oversize !==
          Constants.CallbackObject.Oversize.TRUE;
      if (editFollowupMessageFlag)
        return await bot.helpers.editFollowupMessage(
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
        );
      return await bot.helpers.sendMessage(
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
      );
    } finally {
      singleSuccsessMessageObject = null;
    }
  },
  multiFiles: async (
    multiSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.multiFilesObject | null
  ): Promise<Message> => {
    try {
      const runTime: number =
        new Date().getTime() - Number(multiSuccsessMessageObject!.startTime);
      const editFollowupMessageFlag: boolean =
        runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
        multiSuccsessMessageObject!.oversize !==
          Constants.CallbackObject.Oversize.TRUE;
      if (editFollowupMessageFlag)
        return await bot.helpers.editFollowupMessage(
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
        );
      return await bot.helpers.sendMessage(
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
      );
    } finally {
      multiSuccsessMessageObject = null;
    }
  },
};

export default successMessage;
