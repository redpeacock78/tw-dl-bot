import bot from "@bot/bot.ts";
import { match } from "ts-pattern";
import { Message } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

/**
 * Asynchronously handles error messages and sends them based on the conditions.
 *
 * @param {CreateMessageTypes.sendErrorMessageObject | null} errorMessageObject - The error message object to be processed.
 * @return {Promise<Message>} A promise that resolves to a message response.
 */
const errorMessage = (
  errorMessageObject: CreateMessageTypes.sendErrorMessageObject | null
): Promise<Message> => {
  try {
    const runTime: number =
      new Date().getTime() - Number(errorMessageObject!.startTime);
    const isEditFollowupMessage: boolean =
      runTime <= Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT ||
      errorMessageObject!.oversize !== Constants.CallbackObject.Oversize.TRUE;
    return match(isEditFollowupMessage)
      .with(
        true,
        async (): Promise<Message> =>
          await bot.helpers.editFollowupMessage(
            errorMessageObject!.token,
            errorMessageObject!.message,
            Messages.createErrorMessage({
              runNumber: errorMessageObject!.number,
              description: errorMessageObject!.description,
              link: errorMessageObject!.link,
            })
          )
      )
      .with(
        false,
        async (): Promise<Message> =>
          await bot.helpers.sendMessage(
            errorMessageObject!.channel,
            Messages.createErrorMessage({
              messageId: errorMessageObject!.message,
              channelId: errorMessageObject!.channel,
              runNumber: errorMessageObject!.number,
              description: errorMessageObject!.description,
              link: errorMessageObject!.link,
            })
          )
      )
      .exhaustive();
  } finally {
    errorMessageObject = null;
  }
};

export default errorMessage;
