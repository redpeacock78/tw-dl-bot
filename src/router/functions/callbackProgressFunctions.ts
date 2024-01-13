import bot from "@bot/bot.ts";
import { millisecondChangeFormat } from "@utils";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callbackProgressFunctions: CallbackTypes.Functions.callbackProgress = {
  progress: async (
    c: CallbackTypes.ContextType,
    body: CallbackTypes.bodyDataObject
  ): Promise<Response> => {
    return await bot.helpers
      .editFollowupMessage(`${body.token}`, `${body.message}`, {
        content: body
          .content!.split("\n")
          .map((i: string, n: number): string =>
            n === 0 ? `**${i}**` : `\`${i}\``
          )
          .join("\n"),
        embeds: [
          {
            fields: [
              { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
              {
                name: "🕑 Elapsed Times",
                value: `> \`${millisecondChangeFormat(
                  new Date().getTime() - Number(body.startTime)
                )}\``,
              },
              { name: "🔗 Tweet URL", value: `> ${body.link}` },
            ],
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
      })
      .then((): Response => c.body(null, 204))
      .catch((): Response => c.body(null, 500));
  },
};

export default callbackProgressFunctions;
