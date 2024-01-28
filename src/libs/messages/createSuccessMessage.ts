import { CreateMessage, InteractionCallbackData } from "discordeno";
import { unitChangeForByte, millisecondChangeFormat } from "@utils";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createSuccessMessage = (
  info: CreateMessageTypes.successMessageInfo | null
): CreateMessage | InteractionCallbackData => {
  try {
    return {
      content: "**✅Done!**",
      embeds: [
        {
          fields: [
            { name: "#️⃣ Run Number", value: `> \`#${info!.runNumber}\`` },
            {
              name: "🕑 Total Time",
              value: `> \`${millisecondChangeFormat(info!.runTime)}\``,
            },
            {
              name: "🎞 Video Name",
              value: info!.fileName
                ? `> \`${info!.fileName}\``
                : info!
                    .fileNamesArray!.map((i: string): string => `> \`${i}\``)
                    .join("\n"),
              inline: true,
            },
            {
              name: info!.file ? "📂 File Size" : "📂 Total File Size",
              value: `> \`${unitChangeForByte(info!.totalSize)}\``,
              inline: true,
            },
            { name: "🔗 Tweet URL", value: `> ${info!.link}` },
          ],
          color: 0x4db56a,
          timestamp: new Date().getTime(),
        },
      ],
      file: info!.file
        ? {
            blob: info!.file,
            name: `${info!.fileName}`,
          }
        : info!.filesArray!,
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

export default createSuccessMessage;
