import bot from "@bot/bot.ts";
import { Messages } from "@libs";
import { Message } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const errorMessage = async (
  errorMessageObject: CreateMessageTypes.sendErrorMessageObject | null
): Promise<Message> => {
  try {
    if (errorMessageObject!.editFollowupMessageFlag)
      return await bot.helpers.editFollowupMessage(
        errorMessageObject!.token,
        errorMessageObject!.message,
        Messages.createErrorMessage({
          runNumber: errorMessageObject!.number,
          description: errorMessageObject!.description,
          link: errorMessageObject!.link,
        })
      );
    return await bot.helpers.sendMessage(
      errorMessageObject!.channel,
      Messages.createErrorMessage({
        messageId: errorMessageObject!.message,
        channelId: errorMessageObject!.channel,
        runNumber: errorMessageObject!.number,
        description: errorMessageObject!.description,
        link: errorMessageObject!.link,
      })
    );
  } finally {
    errorMessageObject = null;
  }
};

export default errorMessage;
