import { Constants, Contents } from "@libs";
import { SendMessages } from "@router/messages/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

type InfoObject<T extends string> = CallbackTypes.infoObjectType<T>;

const noContent = Constants.HttpStatus.NO_CONTENT;
const serverError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackSuccessFunctions: CallbackTypes.Functions.callbackSuccess = {
  success: {
    dl: {
      /**
       * Asynchronously handles a single callback success event.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: async <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => {
        if (!infoObject.body)
          return infoObject.c.body(null, { status: serverError });
        let filesObject = await Contents.singleFileContent(infoObject.body)
          .then((i) => i)
          .catch(() => null);
        try {
          if (!filesObject)
            return infoObject.c.body(null, { status: serverError });
          return await SendMessages.successMessage
            .singleFile({
              token: infoObject.body.token,
              channelId: infoObject.body.channel,
              messageId: infoObject.body.message,
              runNumber: infoObject.body.number,
              startTime: infoObject.body.startTime,
              totalSize: infoObject.body.size!,
              fileName: filesObject.fileName,
              link: infoObject.body.link,
              file: filesObject.blobData,
              oversize: infoObject.body.oversize!,
              spoiler: false,
            })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body.token,
            channel: infoObject.body.channel,
            message: infoObject.body.message,
            number: infoObject.body.number,
            link: infoObject.body.link,
            description: (e as Error).message,
            startTime: infoObject.body.startTime,
            oversize: infoObject.body.oversize!,
          })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } finally {
          infoObject.body = null;
          filesObject = null;
        }
      },
      /**
       * Asynchronously handles a multi callback success event.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: async <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => {
        if (!infoObject.body)
          return infoObject.c.body(null, { status: serverError });
        let multiFilesObject = await Contents.multiFilesContent(infoObject.body)
          .then((i) => i)
          .catch(() => null);
        try {
          if (!multiFilesObject)
            return infoObject.c.body(null, { status: serverError });
          return await SendMessages.successMessage
            .multiFiles({
              token: infoObject.body.token,
              channelId: infoObject.body.channel,
              messageId: infoObject.body.message,
              runNumber: infoObject.body.number,
              startTime: infoObject.body.startTime,
              totalSize: infoObject.body.size!,
              fileNamesArray: multiFilesObject.fileNamesArray,
              link: infoObject.body.link,
              filesArray: multiFilesObject.filesArray,
              oversize: infoObject.body.oversize!,
              spoiler: false,
            })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body.token,
            channel: infoObject.body.channel,
            message: infoObject.body.message,
            number: infoObject.body.number,
            link: infoObject.body.link,
            description: (e as Error).message,
            startTime: infoObject.body.startTime,
            oversize: infoObject.body.oversize!,
          })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } finally {
          infoObject.body = null;
          multiFilesObject = null;
        }
      },
    },
    dlSpoiler: {
      /**
       * Asynchronously handles a single callback success event with a spoiler.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: async <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => {
        if (!infoObject.body)
          return infoObject.c.body(null, { status: serverError });
        let filesObject = await Contents.singleFileContent(infoObject.body)
          .then((i) => i)
          .catch(() => null);
        try {
          if (!filesObject)
            return infoObject.c.body(null, { status: serverError });
          return await SendMessages.successMessage
            .singleFile({
              token: infoObject.body.token,
              channelId: infoObject.body.channel,
              messageId: infoObject.body.message,
              runNumber: infoObject.body.number,
              startTime: infoObject.body.startTime,
              totalSize: infoObject.body.size!,
              fileName: filesObject.fileName,
              link: infoObject.body.link,
              file: filesObject.blobData,
              oversize: infoObject.body.oversize!,
              spoiler: true,
            })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body.token,
            channel: infoObject.body.channel,
            message: infoObject.body.message,
            number: infoObject.body.number,
            link: infoObject.body.link,
            description: (e as Error).message,
            startTime: infoObject.body.startTime,
            oversize: infoObject.body.oversize!,
          })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } finally {
          infoObject.body = null;
          filesObject = null;
        }
      },
      /**
       * Asynchronously handles multiple callback success events with a spoiler.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: async <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => {
        if (!infoObject.body)
          return infoObject.c.body(null, { status: serverError });
        let multiFilesObject = await Contents.multiFilesContent(infoObject.body)
          .then((i) => i)
          .catch(() => null);
        try {
          if (!multiFilesObject)
            return infoObject.c.body(null, { status: serverError });
          return await SendMessages.successMessage
            .multiFiles({
              token: infoObject.body.token,
              channelId: infoObject.body.channel,
              messageId: infoObject.body.message,
              runNumber: infoObject.body.number,
              startTime: infoObject.body.startTime,
              totalSize: infoObject.body.size!,
              fileNamesArray: multiFilesObject.fileNamesArray,
              link: infoObject.body.link,
              filesArray: multiFilesObject.filesArray,
              oversize: infoObject.body.oversize!,
              spoiler: true,
            })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } catch (e: unknown) {
          return await SendMessages.errorMessage({
            token: infoObject.body.token,
            channel: infoObject.body.channel,
            message: infoObject.body.message,
            number: infoObject.body.number,
            link: infoObject.body.link,
            description: (e as Error).message,
            startTime: infoObject.body.startTime,
            oversize: infoObject.body.oversize!,
          })
            .then(
              (): Response => infoObject.c.body(null, { status: noContent }),
            )
            .catch(
              (): Response => infoObject.c.body(null, { status: serverError }),
            );
        } finally {
          infoObject.body = null;
          multiFilesObject = null;
        }
      },
    },
  },
};

export default callbackSuccessFunctions;
