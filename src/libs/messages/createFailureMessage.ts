import { CreateMessage, InteractionCallbackData } from "discordeno";
import { millisecondChangeFormat } from "@utils";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createFailureMessage = (
  info: CreateMessageTypes.failureMessageInfo | null
): CreateMessage | InteractionCallbackData => {
  try {
    return {
      content: "**❌Failure!**",
      embeds: [
        {
          fields: [
            { name: "#️⃣ Run Number", value: `> \`#${info!.runNumber}\`` },
            {
              name: "🕑 Total Time",
              value: `> \`${millisecondChangeFormat(info!.runTime)}\``,
            },
            { name: "🔗 Tweet URL", value: `> ${info!.link}` },
          ],
          description: `**${info!.content}**`,
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

export default createFailureMessage;
