import bot from "@bot/bot.ts";
import { FileContent, Message } from "discordeno";
import { Constants, Messages, Contents } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const sendErrorMessage = async (
  errorMessageObject: CreateMessageTypes.sendErrorMessageObject
): Promise<Message> => {
  if (errorMessageObject.editFollowupMessageFlag)
    return await bot.helpers.editFollowupMessage(
      errorMessageObject.token,
      errorMessageObject.message,
      Messages.createErrorMessage({
        runNumber: errorMessageObject.number,
        description: errorMessageObject.description,
        link: errorMessageObject.link,
      })
    );
  return await bot.helpers.sendMessage(
    errorMessageObject.channel,
    Messages.createErrorMessage({
      messageId: errorMessageObject.message,
      channelId: errorMessageObject.channel,
      runNumber: errorMessageObject.number,
      description: errorMessageObject.description,
      link: errorMessageObject.link,
    })
  );
};

const sendSuccessMessage = {
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
        return await sendSuccessMessage
          .single({
            token: body!.token,
            channelId: body!.channel,
            messageId: body!.message,
            runNumber: body!.number,
            runTime: runTime,
            totalSize: body!.size!,
            fileName: filesObject!.fileName,
            link: body!.link,
            file: filesObject!.blobData,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
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
