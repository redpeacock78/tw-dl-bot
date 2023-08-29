import { Hono } from "hono";
import bot from "@bot/bot.ts";
import { sendFollowupMessage, InteractionResponseTypes } from "discordeno";

const callback = new Hono();

callback.post("/callback", async (c): Promise<void | Response> => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  if (body.status === "success") {
    return await sendFollowupMessage(bot, body.token as string, {
      type: InteractionResponseTypes.ChannelMessageWithSource,
      data: {
        content: "**✅Done!**",
        file: {
          blob: new Blob([await file.arrayBuffer()], {
            type: body.type as string,
          }),
          name: body.name as string,
        },
      },
    })
      .then(() => c.text(""))
      .catch(() => c.status(500));
  } else {
    return await sendFollowupMessage(bot, body.token as string, {
      type: InteractionResponseTypes.ChannelMessageWithSource,
      data: {
        content: "❌Failure!",
        embeds: [
          {
            description: `> ${body.link}\n${body.content}`,
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
      },
    })
      .then(() => c.text(""))
      .catch(() => c.status(500));
  }
});

export default callback;
