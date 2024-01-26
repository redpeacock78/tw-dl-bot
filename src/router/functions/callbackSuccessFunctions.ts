import bot from "@bot/bot.ts";
import { FileContent, Message } from "discordeno";
import { Constants, Messages, Contents } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const sendErrorMessage = async (messageObject: {
  token?: string;
  channel?: string;
  message: string;
  number: string;
  link: string;
  description: string;
  editFollowupMessageFlag: boolean;
}): Promise<Message> => {
  if (messageObject.editFollowupMessageFlag)
    return await bot.helpers.editFollowupMessage(
      messageObject.token!,
      messageObject.message,
      Messages.createErrorMessage({
        runNumber: messageObject.number,
        description: messageObject.description,
        link: messageObject.link,
      })
    );
  return await bot.helpers.sendMessage(
    messageObject.channel!,
    Messages.createErrorMessage({
      messageId: messageObject.message,
      channelId: messageObject.channel!,
      runNumber: messageObject.number,
      description: messageObject.description,
      link: messageObject.link,
    })
  );
};

const callbackSuccessFunctions: CallbackTypes.Functions.callbackSuccess = {
  success: {
    dl: {
      single: async <T extends string>(
        c: CallbackTypes.contextType<T>,
        body: CallbackTypes.bodyDataObject | null
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body!.startTime);
        const editFollowupMessageFlag: boolean =
          runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
          body!.oversize !== Constants.CallbackObject.Oversize.TRUE;
        let filesObject: {
          fileName: string;
          blobData: Blob;
        } | null;
        try {
          filesObject = await Contents.singleFileContent(body!);
        } catch (e: unknown) {
          return sendErrorMessage({
            token: body!.token,
            channel: body!.channel,
            message: body!.message,
            number: body!.number,
            link: body!.link,
            description: (e as Error).message,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): null => (body = null));
        }
        if (editFollowupMessageFlag)
          return await bot.helpers
            .editFollowupMessage(
              body!.token,
              body!.message,
              Messages.createSuccessMessage({
                runNumber: body!.number,
                runTime: runTime,
                totalSize: body!.size!,
                fileName: filesObject!.fileName,
                link: body!.link,
                file: filesObject!.blobData,
              })
            )
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): void => {
              body = null;
              filesObject = null;
            });
        return await bot.helpers
          .sendMessage(
            body!.channel,
            Messages.createSuccessMessage({
              messageId: body!.message,
              channelId: body!.channel,
              runNumber: body!.number,
              runTime: runTime,
              totalSize: body!.size!,
              fileName: filesObject!.fileName,
              link: body!.link,
              file: filesObject!.blobData,
            })
          )
          .then((): Response => c.body(null, noContent))
          .catch((): Response => c.body(null, internalServerError))
          .finally((): void => {
            body = null;
            filesObject = null;
          });
      },
      multi: async <T extends string>(
        c: CallbackTypes.contextType<T>,
        body: CallbackTypes.bodyDataObject | null
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body!.startTime);
        const editFollowupMessageFlag: boolean =
          runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
          body!.oversize !== Constants.CallbackObject.Oversize.TRUE;
        let multiFilesObject: {
          fileNamesArray: string[];
          filesArray: FileContent[];
        } | null;
        try {
          multiFilesObject = await Contents.multiFilesContent(body!);
        } catch (e: unknown) {
          return sendErrorMessage({
            token: body!.token,
            channel: body!.channel,
            message: body!.message,
            number: body!.number,
            link: body!.link,
            description: (e as Error).message,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): null => (body = null));
        }
        if (editFollowupMessageFlag)
          return await bot.helpers
            .editFollowupMessage(
              body!.token,
              body!.message,
              Messages.createSuccessMessage({
                runNumber: body!.number,
                runTime: runTime,
                totalSize: body!.size!,
                fileNamesArray: multiFilesObject!.fileNamesArray,
                link: body!.link,
                filesArray: multiFilesObject!.filesArray,
              })
            )
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): void => {
              body = null;
              multiFilesObject = null;
            });
        return await bot.helpers
          .sendMessage(
            body!.channel,
            Messages.createSuccessMessage({
              messageId: body!.message,
              channelId: body!.channel,
              runNumber: body!.number,
              runTime: runTime,
              totalSize: body!.size!,
              fileNamesArray: multiFilesObject!.fileNamesArray,
              link: body!.link,
              filesArray: multiFilesObject!.filesArray,
            })
          )
          .then((): Response => c.body(null, noContent))
          .catch((): Response => c.body(null, internalServerError))
          .finally((): void => {
            body = null;
            multiFilesObject = null;
          });
      },
    },
  },
};

export default callbackSuccessFunctions;
