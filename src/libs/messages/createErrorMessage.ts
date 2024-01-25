import { InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createErrorMessage = (info: CreateMessageTypes.errorMessageInfo) => {
  let message: InteractionCallbackData | null = {
    content: `**⚠️Error**`,
    embeds: [
      {
        ...(typeof info.link !== "undefined"
          ? {
              fields: [
                {
                  name: "🔗 Tweet URL",
                  value: `> ${info.link}`,
                },
              ],
            }
          : {}),
        description: info.description,
        color: 0x4db56a,
        timestamp: new Date().getTime(),
      },
    ],
  };
  try {
    return message;
  } finally {
    message = null;
  }
};

export default createErrorMessage;
