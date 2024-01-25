import bot from "@bot/bot.ts";
import { fileToBlob } from "@utils";
import { FileContent } from "discordeno";
import { Constants, Messages } from "@libs";
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
        let filesArray: File[] | null = Object.keys(body!)
          .filter((i: string): RegExpMatchArray | null => i.match(/file/))
          .map(
            (i: string): File =>
              body![i as keyof CallbackTypes.bodyDataObject] as File
          );
        let namesArray: string[] | null = Object.keys(body!)
          .filter((i: string): RegExpMatchArray | null => i.match(/name/))
          .map(
            (i: string): string =>
              body![i as keyof CallbackTypes.bodyDataObject] as string
          );
        let fileContentArray: FileContent[] | null = await Promise.all(
          namesArray.map(async (i: string, n: number): Promise<FileContent> => {
            return {
              name: i as string,
              blob: await fileToBlob((filesArray as File[])[n] as File),
            };
          })
        );
        if (editFollowupMessageFlag)
          return await bot.helpers
            .editFollowupMessage(
              body!.token,
              body!.message,
              Messages.createSuccessMessage({
                runNumber: body!.number,
                runTime: runTime,
                totalSize: body!.size!,
                fileNamesArray: namesArray,
                link: body!.link,
                filesArray: fileContentArray,
                editFollowupMessageFlag: editFollowupMessageFlag,
              })
            )
            .then((): Response => c.body(null, noContent))
            .catch((): Response => c.body(null, internalServerError))
            .finally((): void => {
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
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
              fileNamesArray: namesArray,
              link: body!.link,
              filesArray: fileContentArray,
              editFollowupMessageFlag: editFollowupMessageFlag,
            })
          )
          .then((): Response => c.body(null, noContent))
          .catch((): Response => c.body(null, internalServerError))
          .finally((): void => {
            filesArray = null;
            namesArray = null;
            fileContentArray = null;
          });
      },
    },
  },
};

export default callbackSuccessFunctions;
