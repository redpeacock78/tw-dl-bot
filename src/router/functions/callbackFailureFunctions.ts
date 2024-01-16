import bot from "@bot/bot.ts";
import { Constants } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { createFailureMessage } from "@router/messages/index.ts";

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
          `${body!.token}`,
          `${body!.message}`,
          createFailureMessage({
            runNumber: body!.number,
            runTime: runTime,
            link: body!.link,
            content: body!.content as string,
            editFollowupMessageFlag: editFollowupMessageFlag,
          })
        )
        .then((): Response => c.body(null, 204))
        .catch((): Response => c.body(null, 500))
        .finally((): null => (body = null));
    return await bot.helpers
      .sendMessage(
        `${body!.channel}`,
        createFailureMessage({
          messageId: body!.message,
          channelId: body!.channel,
          runNumber: body!.number,
          runTime: runTime,
          link: body!.link,
          content: body!.content as string,
          editFollowupMessageFlag: editFollowupMessageFlag,
        })
      )
      .then((): Response => c.body(null, 204))
      .catch((): Response => c.body(null, 500))
      .finally((): null => (body = null));
  },
};

export default callbackFailureFunctions;
