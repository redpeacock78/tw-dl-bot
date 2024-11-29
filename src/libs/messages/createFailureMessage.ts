import { Constants } from "@libs";
import { millisecondChangeFormat } from "@utils";
import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type FailureMessageInfo = CreateMessageTypes.failureMessageInfo | null;

/**
 * Creates a failure message with information about the run number, total time, tweet URL, and content.
 *
 * @param {FailureMessageInfo} info - The information for the failure message.
 * @return {CreateMessage | InteractionCallbackData} The failure message with embeds and content.
 */
const createFailureMessage = (
  info: FailureMessageInfo
): CreateMessage | InteractionCallbackData => {
  if (!info) return {};
  try {
    return {
      content: "**❌Failure!**",
      embeds: [
        {
          fields: [
            { name: "#️⃣ Run Number", value: `> \`#${info.runNumber}\`` },
            {
              name: "🕑 Total Time",
              value: `> \`${millisecondChangeFormat(info.runTime)}\``,
            },
            { name: "🔗 Tweet URL", value: `> ${info.link}` },
          ],
          description: `**${info.content}**`,
          color: Constants.Message.Color.FAILURE,
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

export default createFailureMessage;
