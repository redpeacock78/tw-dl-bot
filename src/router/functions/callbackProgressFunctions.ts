import bot from "@bot/bot.ts";
import { Constants, Messages } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const noContent: number = Constants.HttpStatus.NO_CONTENT;
const internalServerError: number = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackProgressFunctions: CallbackTypes.Functions.callbackProgress = {
  progress: async <T extends string>(
    infoObject: CallbackTypes.infoObjectType<T>
  ): Promise<Response> => {
    const runTime: number =
      new Date().getTime() - Number(infoObject.body!.startTime);
    const editFollowupMessageFlag: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
    if (editFollowupMessageFlag)
      return await bot.helpers
        .editFollowupMessage(
          infoObject.body!.token,
          infoObject.body!.message,
          Messages.createProgressMessage({
            runNumber: infoObject.body!.number,
            runTime: runTime,
            link: infoObject.body!.link,
            content: infoObject.body!.content as string,
          })
        )
        .then((): Response => infoObject.c.body(null, noContent))
        .catch((): Response => infoObject.c.body(null, internalServerError))
        .finally((): null => (infoObject.body = null));
    try {
      return infoObject.c.body(null, noContent);
    } finally {
      infoObject.body = null;
    }
  },
};

export default callbackProgressFunctions;
