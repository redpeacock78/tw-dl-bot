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
        infoObject: CallbackTypes.infoObjectType<T>
      ): Promise<Response> => {
        const runTime: number =
          new Date().getTime() - Number(infoObject.body!.startTime);
        const editFollowupMessageFlag: boolean =
          runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
          infoObject.body!.oversize !== Constants.CallbackObject.Oversize.TRUE;
        let filesObject: ContentsTypes.singleFileContentObject | null;
        try {
          filesObject = await Contents.singleFileContent(infoObject.body!);
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body!.token,
            channel: infoObject.body!.channel,
            message: infoObject.body!.message,
            number: infoObject.body!.number,
            link: infoObject.body!.link,
            description: (e as Error).message,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
            .then((): Response => infoObject.c.body(null, noContent))
            .catch((): Response => infoObject.c.body(null, internalServerError))
            .finally((): null => (infoObject.body = null));
        }
        return await SendMessages.successMessage
          .singleFile({
            token: infoObject.body!.token,
            channelId: infoObject.body!.channel,
            messageId: infoObject.body!.message,
            runNumber: infoObject.body!.number,
            runTime: runTime,
            totalSize: infoObject.body!.size!,
            fileName: filesObject!.fileName,
            link: infoObject.body!.link,
            file: filesObject!.blobData,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
          .then((): Response => infoObject.c.body(null, noContent))
          .catch((): Response => infoObject.c.body(null, internalServerError))
          .finally((): void => {
            infoObject.body = null;
            filesObject = null;
          });
      },
      multi: async <T extends string>(
        infoObject: CallbackTypes.infoObjectType<T>
      ): Promise<Response> => {
        const runTime: number =
          new Date().getTime() - Number(infoObject.body!.startTime);
        const editFollowupMessageFlag: boolean =
          runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
          infoObject.body!.oversize !== Constants.CallbackObject.Oversize.TRUE;
        let multiFilesObject: ContentsTypes.multiFilesContentObject | null;
        try {
          multiFilesObject = await Contents.multiFilesContent(infoObject.body!);
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body!.token,
            channel: infoObject.body!.channel,
            message: infoObject.body!.message,
            number: infoObject.body!.number,
            link: infoObject.body!.link,
            description: (e as Error).message,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
            .then((): Response => infoObject.c.body(null, noContent))
            .catch((): Response => infoObject.c.body(null, internalServerError))
            .finally((): null => (infoObject.body = null));
        }
        return await SendMessages.successMessage
          .multiFiles({
            token: infoObject.body!.token,
            channelId: infoObject.body!.channel,
            messageId: infoObject.body!.message,
            runNumber: infoObject.body!.number,
            runTime: runTime,
            totalSize: infoObject.body!.size!,
            fileNamesArray: multiFilesObject!.fileNamesArray,
            link: infoObject.body!.link,
            filesArray: multiFilesObject!.filesArray,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
          .then((): Response => infoObject.c.body(null, noContent))
          .catch((): Response => infoObject.c.body(null, internalServerError))
          .finally((): void => {
            infoObject.body = null;
            multiFilesObject = null;
          });
      },
    },
  },
};

export default callbackSuccessFunctions;
