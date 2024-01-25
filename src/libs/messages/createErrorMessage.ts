import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createErrorMessage = (
  info: CreateMessageTypes.errorMessageInfo
): CreateMessage | InteractionCallbackData => {
  let message: CreateMessage | InteractionCallbackData | null = {
    content: `**⚠️Error**`,
    embeds: [
      {
        ...(typeof info.link !== "undefined"
          ? {
              fields: [
                ...(typeof info.runNumber !== "undefined"
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
        description: info.description,
        color: 0x4db56a,
        timestamp: new Date().getTime(),
      },
    ],
    ...(info.editFollowupMessageFlag
      ? {}
      : {
          messageReference: {
            messageId: `${info!.messageId}`,
            channelId: `${info!.channelId}`,
            failIfNotExists: true,
          },
        }),
  };
  try {
    return message;
  } finally {
    message = null;
  }
};

export default createErrorMessage;
