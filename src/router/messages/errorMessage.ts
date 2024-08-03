import bot from "@bot/bot.ts";
import { Match } from "functional";
import { Message } from "discordeno";
import { Messages, Constants } from "@libs";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type SendErrorMessageObject = CreateMessageTypes.sendErrorMessageObject | null;

const trueOversize = Constants.CallbackObject.Oversize.TRUE;
const editFollowupMessageTimeLimit = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;

/**
 * Asynchronously handles error messages and sends them based on the conditions.
 *
 * @param {SendErrorMessageObject} errorMessageObject - The error message object to be processed.
 * @return {Promise<Message>} A promise that resolves to a message response.
 */
const errorMessage = (
  errorMessageObject: SendErrorMessageObject
): Promise<Message> => {
  const runTime: number =
    new Date().getTime() - Number(errorMessageObject!.startTime);
  const isEditFollowupMessage: boolean =
    runTime <= editFollowupMessageTimeLimit ||
    errorMessageObject!.oversize !== trueOversize;
  return Match(isEditFollowupMessage)
    .with(
      true,
      async (): Promise<Message> =>
        await bot.helpers
          .editFollowupMessage(
            errorMessageObject!.token,
            errorMessageObject!.message,
            Messages.createErrorMessage({
              runNumber: errorMessageObject!.number,
              description: errorMessageObject!.description,
              link: errorMessageObject!.link,
            })
          )
          .finally((): null => (errorMessageObject = null))
    )
    .with(
      false,
      async (): Promise<Message> =>
        await bot.helpers
          .sendMessage(
            errorMessageObject!.channel,
            Messages.createErrorMessage({
              messageId: errorMessageObject!.message,
              channelId: errorMessageObject!.channel,
              runNumber: errorMessageObject!.number,
              description: errorMessageObject!.description,
              link: errorMessageObject!.link,
            })
          )
          .finally((): null => (errorMessageObject = null))
    )
    .exhaustive();
};

export default errorMessage;
