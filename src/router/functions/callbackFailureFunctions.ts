import bot from "@bot/bot.ts";
import { match } from "ts-pattern";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

type InfoObject<T extends string> = CallbackTypes.infoObjectType<T>;

const noContent = Constants.HttpStatus.NO_CONTENT;
const internalServerError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackFailureFunctions: CallbackTypes.Functions.callbackFailure = {
  /**
   * Handles the failure callback for the given infoObject.
   *
   * @param {InfoObject<T>} infoObject - The info object containing the necessary data for the callback.
   * @return {Promise<Response>} A promise that resolves to the response of the callback.
   */
  failure: <T extends string>(infoObject: InfoObject<T>): Promise<Response> => {
    const runTime: number =
      new Date().getTime() - Number(infoObject.body!.startTime);
    const isEditFollowupMessage: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
    return match(isEditFollowupMessage)
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
                content: infoObject.body!.content!,
              })
            )
            .then(
              (): Response => infoObject.c.body(null, { status: noContent })
            )
            .catch(
              (): Response =>
                infoObject.c.body(null, { status: internalServerError })
            )
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
                content: infoObject.body!.content!,
              })
            )
            .then(
              (): Response => infoObject.c.body(null, { status: noContent })
            )
            .catch(
              (): Response =>
                infoObject.c.body(null, { status: internalServerError })
            )
            .finally((): null => (infoObject.body = null))
      )
      .exhaustive();
  },
};

export default callbackFailureFunctions;
