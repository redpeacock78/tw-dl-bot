import { Constants, Contents } from "@libs";
import { SendMessages } from "@router/messages/index.ts";
import { ContentsTypes } from "@libs/types/contentsTypes.ts";
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
        let filesObject: ContentsTypes.singleFileContentObject | null;
        try {
          filesObject = await Contents.singleFileContent(body!);
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
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
        return await SendMessages.successMessage
          .singleFile({
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
        let multiFilesObject: ContentsTypes.multiFilesContentObject | null;
        try {
          multiFilesObject = await Contents.multiFilesContent(body!);
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
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
        return await SendMessages.successMessage
          .multiFiles({
            token: body!.token,
            channelId: body!.channel,
            messageId: body!.message,
            runNumber: body!.number,
            runTime: runTime,
            totalSize: body!.size!,
            fileNamesArray: multiFilesObject!.fileNamesArray,
            link: body!.link,
            filesArray: multiFilesObject!.filesArray,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
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
