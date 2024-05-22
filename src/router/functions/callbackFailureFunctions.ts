import bot from "@bot/bot.ts";
import { match } from "ts-pattern";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackFailureFunctions: CallbackTypes.Functions.callbackFailure = {
  /**
   * Handles the failure callback for the given infoObject.
   *
   * @param {CallbackTypes.infoObjectType<T>} infoObject - The info object containing the necessary data for the callback.
   * @return {Promise<Response>} A promise that resolves to the response of the callback.
   */
  failure: <T extends string>(
    infoObject: CallbackTypes.infoObjectType<T>
  ): Promise<Response> => {
    const runTime: number =
      new Date().getTime() - Number(infoObject.body!.startTime);
    const editFollowupMessageFlag: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
    return match(editFollowupMessageFlag)
      .with(
        true,
        async (): Promise<Response> =>
          await bot.helpers
            .editFollowupMessage(
              infoObject.body!.token,
              infoObject.body!.message,
              Messages.createFailureMessage({
                runNumber: infoObject.body!.number,
                runTime: runTime,
                link: infoObject.body!.link,
                content: infoObject.body!.content as string,
              })
            )
            .then((): Response => infoObject.c.body(null, noContent))
            .catch((): Response => infoObject.c.body(null, internalServerError))
            .finally((): null => (infoObject.body = null))
      )
      .with(
        false,
        async (): Promise<Response> =>
          await bot.helpers
            .sendMessage(
              infoObject.body!.channel,
              Messages.createFailureMessage({
                messageId: infoObject.body!.message,
                channelId: infoObject.body!.channel,
                runNumber: infoObject.body!.number,
                runTime: runTime,
                link: infoObject.body!.link,
                content: infoObject.body!.content as string,
              })
            )
            .then((): Response => infoObject.c.body(null, noContent))
            .catch((): Response => infoObject.c.body(null, internalServerError))
            .finally((): null => (infoObject.body = null))
      )
      .exhaustive();
  },
};

export default callbackFailureFunctions;
