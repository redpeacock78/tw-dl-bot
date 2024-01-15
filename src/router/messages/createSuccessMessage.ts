import { FileContent } from "discordeno";
import { unitChangeForByte, millisecondChangeFormat } from "@utils";

type messageInfo = {
  messageId?: string;
  channelId?: string;
  runNumber: string;
  runTime: number;
  totalSize: string;
  fileName?: string;
  fileNamesArray?: string[];
  link: string;
  file?: Blob;
  filesArray?: FileContent[];
  editFlag: boolean;
};

const createSuccessMessage = (info: messageInfo) => {
  const message = {
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
            value: info.fileName
              ? `> \`${info.fileName}\``
              : info
                  .fileNamesArray!.map(
                    (i: string | File): string => `> \`${i}\``
                  )
                  .join("\n"),
            inline: true,
          },
          {
            name: "📂 Total File Size",
            value: `> \`${unitChangeForByte(info.totalSize)}\``,
            inline: true,
          },
          { name: "🔗 Tweet URL", value: `> ${info.link}` },
        ],
        color: 0x4db56a,
        timestamp: new Date().getTime(),
      },
    ],
    file: info.file
      ? {
          blob: info.file,
          name: `${info.fileName}`,
        }
      : info.filesArray!,
  };
  if (!info.editFlag) {
    const messageReference = {
      messageReference: {
        messageId: `${info.messageId}`,
        channelId: `${info.channelId}`,
        failIfNotExists: true,
      },
    };
    Object.assign(message, messageReference);
  }
  return message;
};

export default createSuccessMessage;
