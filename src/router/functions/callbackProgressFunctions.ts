import bot from "@bot/bot.ts";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackProgressFunctions: CallbackTypes.Functions.callbackProgress = {
  progress: async <T extends string>(
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
          Messages.createProgressMessage({
            runNumber: body!.number,
            runTime: runTime,
            link: body!.link,
            content: body!.content as string,
          })
        )
        .then((): Response => c.body(null, noContent))
        .catch((): Response => c.body(null, internalServerError))
        .finally((): null => (body = null));
    try {
      return c.body(null, noContent);
    } finally {
      body = null;
    }
  },
};

export default callbackProgressFunctions;
