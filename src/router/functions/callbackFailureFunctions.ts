import bot from "@bot/bot.ts";
import { millisecondChangeFormat } from "@utils";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callbackFailureFunctions: CallbackTypes.Functions.callbackFailure = {
  failure: async (
    c: CallbackTypes.ContextType,
    body: CallbackTypes.bodyDataObject | null
  ): Promise<Response> =>
    await bot.helpers
      .editFollowupMessage(`${body!.token}`, `${body!.message}`, {
        content: "**❌Failure!**",
        embeds: [
          {
            fields: [
              { name: "#️⃣ Run Number", value: `> \`#${body!.number}\`` },
              {
                name: "🕑 Total Time",
                value: `> \`${millisecondChangeFormat(
                  new Date().getTime() - Number(body!.startTime)
                )}\``,
              },
              { name: "🔗 Tweet URL", value: `> ${body!.link}` },
            ],
            description: body!.content,
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
      })
      .then((): Response => c.body(null, 204))
      .catch((): Response => c.body(null, 500))
      .finally((): null => (body = null)),
};

export default callbackFailureFunctions;
