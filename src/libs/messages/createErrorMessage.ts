import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createErrorMessage = (
  info: CreateMessageTypes.errorMessageInfo | null
): CreateMessage | InteractionCallbackData => {
  try {
    return {
      content: `**⚠️Error!**`,
      embeds: [
        {
          ...(typeof info!.link !== "undefined"
            ? {
                fields: [
                  ...(typeof info!.runNumber !== "undefined"
                    ? [
                        {
                          name: "#️⃣ Run Number",
                          value: `> \`#${info!.runNumber}\``,
                        },
                      ]
                    : []),
                  {
                    name: "🔗 Tweet URL",
                    value: `> ${info!.link}`,
                  },
                ],
              }
            : {}),
          description: `**${info!.description}**`,
          color: 0x4db56a,
          timestamp: new Date().getTime(),
        },
      ],
      ...(typeof info!.messageId === "undefined" &&
      typeof info!.channelId === "undefined"
        ? {}
        : {
            messageReference: {
              messageId: `${info!.messageId}`,
              channelId: `${info!.channelId}`,
              failIfNotExists: true,
            },
          }),
    };
  } finally {
    info = null;
  }
};

export default createErrorMessage;
