import bot from "@bot/bot.ts";
import { Messages } from "@libs";
import { Message } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const successMessage = {
  single: async (
    singleSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.singleObject
  ): Promise<Message> => {
    if (singleSuccsessMessageObject.editFollowupMessageFlag)
      return await bot.helpers.editFollowupMessage(
        singleSuccsessMessageObject.token,
        singleSuccsessMessageObject.messageId,
        Messages.createSuccessMessage({
          runNumber: singleSuccsessMessageObject.runNumber,
          runTime: singleSuccsessMessageObject.runTime,
          totalSize: singleSuccsessMessageObject.totalSize,
          fileName: singleSuccsessMessageObject.fileName,
          link: singleSuccsessMessageObject.link,
          file: singleSuccsessMessageObject.file,
        })
      );
    return await bot.helpers.sendMessage(
      singleSuccsessMessageObject.channelId,
      Messages.createSuccessMessage({
        messageId: singleSuccsessMessageObject.messageId,
        channelId: singleSuccsessMessageObject.channelId,
        runNumber: singleSuccsessMessageObject.runNumber,
        runTime: singleSuccsessMessageObject.runTime,
        totalSize: singleSuccsessMessageObject.totalSize,
        fileName: singleSuccsessMessageObject.fileName,
        link: singleSuccsessMessageObject.link,
        file: singleSuccsessMessageObject.file,
      })
    );
  },
  multi: async (
    multiSuccsessMessageObject: CreateMessageTypes.SendSuccessMessage.multiObject
  ): Promise<Message> => {
    if (multiSuccsessMessageObject.editFollowupMessageFlag)
      return await bot.helpers.editFollowupMessage(
        multiSuccsessMessageObject.token,
        multiSuccsessMessageObject.messageId,
        Messages.createSuccessMessage({
          runNumber: multiSuccsessMessageObject.runNumber,
          runTime: multiSuccsessMessageObject.runTime,
          totalSize: multiSuccsessMessageObject.totalSize,
          fileNamesArray: multiSuccsessMessageObject.fileNamesArray,
          link: multiSuccsessMessageObject.link,
          filesArray: multiSuccsessMessageObject.filesArray,
        })
      );
    return await bot.helpers.sendMessage(
      multiSuccsessMessageObject.channelId,
      Messages.createSuccessMessage({
        messageId: multiSuccsessMessageObject.messageId,
        channelId: multiSuccsessMessageObject.channelId,
        runNumber: multiSuccsessMessageObject.runNumber,
        runTime: multiSuccsessMessageObject.runTime,
        totalSize: multiSuccsessMessageObject.totalSize,
        fileNamesArray: multiSuccsessMessageObject.fileNamesArray,
        link: multiSuccsessMessageObject.link,
        filesArray: multiSuccsessMessageObject.filesArray,
      })
    );
  },
};

export default successMessage;
