import { CreateMessage, InteractionCallbackData } from "discordeno";
import { millisecondChangeFormat } from "@utils";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createProgressMessage = (
  info: CreateMessageTypes.progressMessageInfo
): CreateMessage | InteractionCallbackData => {
  let message: CreateMessage | InteractionCallbackData | null = {
    content: info
      .content!.split("\n")
      .map((i: string, n: number): string =>
        n === 0 ? `**${i}**` : `\`${i}\``
      )
      .join("\n"),
    embeds: [
      {
        fields: [
          { name: "#️⃣ Run Number", value: `> \`#${info.runNumber}\`` },
          {
            name: "🕑 Elapsed Times",
            value: `> \`${millisecondChangeFormat(info.runTime)}\``,
          },
          { name: "🔗 Tweet URL", value: `> ${info.link}` },
        ],
        color: 0x4db56a,
        timestamp: new Date().getTime(),
      },
    ],
  };
  try {
    return message;
  } finally {
    message = null;
  }
};
export default createProgressMessage;
