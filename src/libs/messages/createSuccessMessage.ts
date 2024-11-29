import { Constants } from "@libs";
import { unitChangeForByte, millisecondChangeFormat } from "@utils";
import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type SuccessMessageInfo = CreateMessageTypes.successMessageInfo | null;

/**
 * Creates a success message with information about the run, time, video name, file size, and tweet URL.
 *
 * @param {SuccessMessageInfo} info - The information about the run and file.
 * @return {CreateMessage | InteractionCallbackData} The success message with embeds and file.
 */
const createSuccessMessage = (
  info: SuccessMessageInfo
): CreateMessage | InteractionCallbackData => {
  if (!info) return {};
  try {
    return {
      content: "**✅Done!**",
      embeds: [
        {
          fields: [
            { name: "#️⃣ Run Number", value: `> \`#${info.runNumber}\`` },
            {
              name: "🕑 Total Time",
              value: `> \`${millisecondChangeFormat(info.runTime)}\``,
            },
            {
              name: "🎞 Video Name",
              value: info!.fileName
                ? `> \`${info.fileName}\``
                : info
                    .fileNamesArray!.map((i: string): string => `> \`${i}\``)
                    .join("\n"),
              inline: true,
            },
            {
              name: info.file ? "📂 File Size" : "📂 Total File Size",
              value: `> \`${unitChangeForByte(info.totalSize)}\``,
              inline: true,
            },
            { name: "🔗 Tweet URL", value: `> ${info.link}` },
          ],
          color: Constants.Message.Color.SUCCESS,
          timestamp: new Date().getTime(),
        },
      ],
      file: info.file
        ? {
            blob: info.file,
            name: `${info.fileName}`,
          }
        : info.filesArray!,
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

export default createSuccessMessage;
