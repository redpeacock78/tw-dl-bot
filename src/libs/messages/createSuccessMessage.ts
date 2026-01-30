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
  info: SuccessMessageInfo,
): CreateMessage | InteractionCallbackData => {
  if (!info) return {};
  try {
    return {
      content: Constants.Message.Content.Status.SUCCESS,
      embeds: [
        {
          fields: [
            {
              name: Constants.Message.Embeds.Fields.Names.RUN_NUMBER,
              value: `> \`#${info.runNumber}\``,
            },
            {
              name: Constants.Message.Embeds.Fields.Names.TOTAL_TIME,
              value: `> \`${millisecondChangeFormat(info.runTime)}\``,
            },
            {
              name: Constants.Message.Embeds.Fields.Names.VIDEO_NAME,
              value: info.fileName
                ? `> \`${info.fileName}\``
                : (info.fileNamesArray ?? [])
                    .map((i: string): string => `> \`${i}\``)
                    .join("\n"),
              inline: true,
            },
            {
              name: info.file
                ? Constants.Message.Embeds.Fields.Names.FILE_SIZE
                : Constants.Message.Embeds.Fields.Names.TOTAL_FILE_SIZE,
              value: `> \`${unitChangeForByte(info.totalSize)}\``,
              inline: true,
            },
            {
              name: Constants.Message.Embeds.Fields.Names.SOURCE_URL,
              value: `> ${info.link}`,
            },
          ],
          color: Constants.Message.Color.SUCCESS,
          timestamp: new Date().getTime(),
        },
      ],
      file: info.file
        ? {
            blob: info.file,
            name: `${info.spoiler ? Constants.Message.File.Name.SPOILER_PREFIX : ""}${info.fileName}`,
          }
        : info.spoiler
          ? (info.filesArray ?? []).map((file) => ({
              blob: file.blob,
              name: `${Constants.Message.File.Name.SPOILER_PREFIX}${file.name}`,
            }))
          : (info.filesArray ?? []),
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
