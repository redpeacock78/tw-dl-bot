import { CreateMessage, InteractionCallbackData } from "discordeno";
import { millisecondChangeFormat } from "@utils";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

const createProgressMessage = (
  info: CreateMessageTypes.progressMessageInfo | null
): CreateMessage | InteractionCallbackData => {
  try {
    return {
      content: info!
        .content!.split("\n")
        .map((i: string, n: number): string =>
          n === 0 ? `**${i}**` : `\`${i}\``
        )
        .join("\n"),
      embeds: [
        {
          fields: [
            ...(typeof info!.runNumber !== "undefined"
              ? [{ name: "#️⃣ Run Number", value: `> \`#${info!.runNumber}\`` }]
              : []),
            ...(typeof info!.runTime !== "undefined"
              ? [
                  {
                    name: "🕑 Elapsed Times",
                    value: `> \`${millisecondChangeFormat(info!.runTime)}\``,
                  },
                ]
              : []),
            { name: "🔗 Tweet URL", value: `> ${info!.link}` },
          ],
          color: 0x4db56a,
          timestamp: new Date().getTime(),
        },
      ],
    };
  } finally {
    info = null;
  }
};
export default createProgressMessage;
