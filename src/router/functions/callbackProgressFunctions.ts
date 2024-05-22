import bot from "@bot/bot.ts";
import { match } from "ts-pattern";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackProgressFunctions: CallbackTypes.Functions.callbackProgress = {
  /**
   * Asynchronously updates the progress of a callback by editing a follow-up message.
   *
   * @param {CallbackTypes.infoObjectType<T>} infoObject - The information object containing the necessary data for the callback.
   * @return {Promise<Response>} A promise that resolves to the response of the callback.
   */
  progress: <T extends string>(
    infoObject: CallbackTypes.infoObjectType<T>
  ): Response | Promise<Response> => {
    const runTime: number =
      new Date().getTime() - Number(infoObject.body!.startTime);
    const isEditFollowupMessage: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
    try {
      return match(isEditFollowupMessage)
        .with(
          true,
          async (): Promise<Response> =>
            await bot.helpers
              .editFollowupMessage(
                infoObject.body!.token,
                infoObject.body!.message,
                Messages.createProgressMessage({
                  runNumber: infoObject.body!.number,
                  runTime: runTime,
                  link: infoObject.body!.link,
                  content: infoObject.body!.content!,
                })
              )
              .then((): Response => infoObject.c.body(null, noContent))
              .catch(
                (): Response => infoObject.c.body(null, internalServerError)
              )
              .finally((): null => (infoObject.body = null))
        )
        .with(false, (): Response => infoObject.c.body(null, noContent))
        .exhaustive();
    } finally {
      infoObject.body = null;
    }
  },
};

export default callbackProgressFunctions;
