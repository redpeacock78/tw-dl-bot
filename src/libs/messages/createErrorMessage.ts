import { Constants } from "@libs";
import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type ErrorMessageInfo = CreateMessageTypes.errorMessageInfo | null;

/**
 * Creates an error message with the specified information.
 *
 * @param {ErrorMessageInfo} info - The information for the error message.
 * @return {CreateMessage | InteractionCallbackData} The error message with content and embeds.
 */
const createErrorMessage = (
  info: ErrorMessageInfo
): CreateMessage | InteractionCallbackData => {
  if (!info) return {};
  try {
    return {
      content: `**⚠️Error!**`,
      embeds: [
        {
          ...(info.link
            ? {
                fields: [
                  ...(info.runNumber
                    ? [
                        {
                          name: "#️⃣ Run Number",
                          value: `> \`#${info.runNumber}\``,
                        },
                      ]
                    : []),
                  {
                    name: "🔗 Tweet URL",
                    value: `> ${info.link}`,
                  },
                ],
              }
            : {}),
          description: `**${info.description}**`,
          color: Constants.Message.Color.ERROR,
          timestamp: new Date().getTime(),
        },
      ],
      ...(info.messageId && info.channelId
        ? {
            messageReference: {
              messageId: `${info.messageId}`,
              channelId: `${info.channelId}`,
              failIfNotExists: true,
            },
          }
        : {}),
    };
  } finally {
    info = null;
  }
};

export default createErrorMessage;
