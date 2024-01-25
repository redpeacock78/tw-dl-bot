import bot from "@bot/bot.ts";
import { fileToBlob } from "@utils";
import { FileContent } from "discordeno";
import { Constants, Messages, multiFilesContent } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

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
        let blobData: Blob | null = await fileToBlob(body!.file1 as File);
        if (editFollowupMessageFlag)
          return await bot.helpers
            .editFollowupMessage(
              body!.token,
              body!.message,
              Messages.createSuccessMessage({
                runNumber: body!.number,
                runTime: runTime,
                totalSize: body!.size!,
                fileName: body!.name1!,
                link: body!.link,
                file: blobData,
                editFollowupMessageFlag: editFollowupMessageFlag,
              })
            )
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): void => {
              body = null;
              blobData = null;
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
              fileName: body!.name1!,
              link: body!.link,
              file: blobData,
              editFollowupMessageFlag: editFollowupMessageFlag,
            })
          )
          .then((): Response => c.body(null, noContent))
          .catch((): Response => c.body(null, internalServerError))
          .finally((): void => {
            body = null;
            blobData = null;
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
          multiFilesObject = await multiFilesContent(body!);
        } catch (e: unknown) {
          if (editFollowupMessageFlag)
            return await bot.helpers
              .editFollowupMessage(
                body!.token,
                body!.message,
                Messages.createErrorMessage({
                  runNumber: body!.number,
                  description: (e as Error).message,
                  link: body!.link,
                })
              )
              .then((): Response => c.body(null, noContent))
              .catch((): Response => c.body(null, internalServerError))
              .finally((): null => (body = null));
          return await bot.helpers
            .sendMessage(
              body!.channel,
              Messages.createErrorMessage({
                runNumber: body!.number,
                description: (e as Error).message,
                link: body!.link,
              })
            )
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
                editFollowupMessageFlag: editFollowupMessageFlag,
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
              editFollowupMessageFlag: editFollowupMessageFlag,
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
