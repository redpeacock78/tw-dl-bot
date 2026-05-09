import { Constants, Contents } from "@libs";
import { SendMessages } from "@router/messages/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

type InfoObject<T extends string> = CallbackTypes.infoObjectType<T>;

const noContent = Constants.HttpStatus.NO_CONTENT;
const serverError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Common single-file success handler. The `useThread` flag controls whether
 * the message is edited in-place via `editMessage` (thread mode) or via
 * `editFollowupMessage` (interaction follow-up mode).
 */
const handleSingleSuccess = async <T extends string>(
  infoObject: InfoObject<T>,
  spoiler: boolean,
  useThread: boolean,
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
        spoiler,
        useThread,
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
      useThread,
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
};

/**
 * Common multi-file success handler. The `useThread` flag controls whether
 * the message is edited in-place via `editMessage` (thread mode) or via
 * `editFollowupMessage` (interaction follow-up mode).
 */
const handleMultiSuccess = async <T extends string>(
  infoObject: InfoObject<T>,
  spoiler: boolean,
  useThread: boolean,
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
        spoiler,
        useThread,
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
      useThread,
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
};

const callbackSuccessFunctions: CallbackTypes.Functions.callbackSuccess = {
  success: {
    dl: {
      /**
       * Asynchronously handles a single callback success event.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleSingleSuccess(infoObject, false, false),
      /**
       * Asynchronously handles a multi callback success event.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleMultiSuccess(infoObject, false, false),
    },
    dlSpoiler: {
      /**
       * Asynchronously handles a single callback success event with a spoiler.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleSingleSuccess(infoObject, true, false),
      /**
       * Asynchronously handles multiple callback success events with a spoiler.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleMultiSuccess(infoObject, true, false),
    },
    threadDl: {
      /**
       * Asynchronously handles a single callback success event for a thread
       * download. Uses `editMessage` instead of `editFollowupMessage` so the
       * resolved message lands inside the thread channel.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleSingleSuccess(infoObject, false, true),
      /**
       * Asynchronously handles multi callback success events for a thread
       * download. Uses `editMessage` instead of `editFollowupMessage`.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleMultiSuccess(infoObject, false, true),
    },
    threadDlSpoiler: {
      /**
       * Asynchronously handles a single callback success event for a thread
       * download with spoiler. Uses `editMessage` (thread mode) and applies
       * the `SPOILER_` filename prefix via `spoiler=true`.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      single: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleSingleSuccess(infoObject, true, true),
      /**
       * Asynchronously handles multi callback success events for a thread
       * download with spoiler. Uses `editMessage` (thread mode) and applies
       * the `SPOILER_` filename prefix via `spoiler=true`.
       *
       * @param {InfoObject<T>} infoObject - The information object containing the necessary data for the callback success event.
       * @return {Promise<Response>} A promise that resolves to a Response object.
       */
      multi: <T extends string>(
        infoObject: InfoObject<T>,
      ): Promise<Response> => handleMultiSuccess(infoObject, true, true),
    },
  },
};

export default callbackSuccessFunctions;
