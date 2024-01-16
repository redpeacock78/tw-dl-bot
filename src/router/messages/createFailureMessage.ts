import { CreateMessage, InteractionCallbackData } from "discordeno";
import { millisecondChangeFormat } from "@utils";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createFailureMessage = (
  info: CreateMessageTypes.failureMessageInfo
): CreateMessage | InteractionCallbackData => {
  let message: CreateMessage | InteractionCallbackData | null = {
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
        color: 0x4db56a,
        timestamp: new Date().getTime(),
      },
    ],
  };
  if (!info.editFollowupMessageFlag) {
    const messageReference = {
      messageReference: {
        messageId: `${info!.messageId}`,
        channelId: `${info!.channelId}`,
        failIfNotExists: true,
      },
    };
    Object.assign(message, messageReference);
  }
  try {
    return message;
  } finally {
    message = null;
  }
};

export default createFailureMessage;
