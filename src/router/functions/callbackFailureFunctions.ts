import bot from "@bot/bot.ts";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackFailureFunctions: CallbackTypes.Functions.callbackFailure = {
  failure: async <T extends string>(
    c: CallbackTypes.contextType<T>,
    body: CallbackTypes.bodyDataObject | null
  ): Promise<Response> => {
    const runTime: number = new Date().getTime() - Number(body!.startTime);
    const editFollowupMessageFlag: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
    if (editFollowupMessageFlag)
      return await bot.helpers
        .editFollowupMessage(
          body!.token,
          body!.message,
          Messages.createFailureMessage({
            runNumber: body!.number,
            runTime: runTime,
            link: body!.link,
            content: body!.content as string,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
        )
        .then((): Response => c.body(null, noContent))
        .catch((): Response => c.body(null, internalServerError))
        .finally((): null => (body = null));
    return await bot.helpers
      .sendMessage(
        body!.channel,
        Messages.createFailureMessage({
          messageId: body!.message,
          channelId: body!.channel,
          runNumber: body!.number,
          runTime: runTime,
          link: body!.link,
          content: body!.content as string,
          editFollowupMessageFlag: editFollowupMessageFlag,
        })
      )
      .then((): Response => c.body(null, noContent))
      .catch((): Response => c.body(null, internalServerError))
      .finally((): null => (body = null));
  },
};

export default callbackFailureFunctions;
