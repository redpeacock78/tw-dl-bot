import { Constants } from "@libs";
import { millisecondChangeFormat } from "@utils";
import { CreateMessage, InteractionCallbackData } from "discordeno";
import { CreateMessageTypes } from "@router/types/createMessageTypes.ts";

type ProgressMessageInfo = CreateMessageTypes.progressMessageInfo | null;

/**
 * Creates a progress message with information about the run number, elapsed time, and tweet URL.
 *
 * @param {ProgressMessageInfo} info - The information for the progress message.
 * @return {CreateMessage | InteractionCallbackData} The progress message with embeds.
 */
const createProgressMessage = (
  info: ProgressMessageInfo
): CreateMessage | InteractionCallbackData => {
  if (!info) return {};
  try {
    return {
      content: info.content
        .split("\n")
        .flatMap((i: string, n: number): string[] =>
          !i
            ? []
            : [
                n === 0
                  ? `**${i}**`.replace(
                      /\.\.\./,
                      `...${Constants.AppEmoji.LOADING_SPINNER}`
                    )
                  : `\`${i}\``,
              ]
        )
        .join("\n"),
      embeds: [
        {
          fields: [
            ...(typeof info.runNumber !== "undefined"
              ? [
                  {
                    name: Constants.Message.Embeds.Fields.Names.RUN_NUMBER,
                    value: `> \`#${info.runNumber}\``,
                  },
                ]
              : []),
            ...(typeof info.runTime !== "undefined"
              ? [
                  {
                    name: Constants.Message.Embeds.Fields.Names.ELAPSED_TIME,
                    value: `> \`${millisecondChangeFormat(info.runTime)}\``,
                  },
                ]
              : []),
            {
              name: Constants.Message.Embeds.Fields.Names.SOURCE_URL,
              value: `> ${info.link}`,
            },
          ],
          color: Constants.Message.Color.PROGRESS,
          timestamp: new Date().getTime(),
        },
      ],
    };
  } finally {
    info = null;
  }
};
export default createProgressMessage;
