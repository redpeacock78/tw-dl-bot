import { Hono } from "hono";
import bot from "@bot/bot.ts";
import { InteractionResponseTypes } from "discordeno";

const callback = new Hono();

callback.post("/callback", async (c): Promise<void | Response> => {
  const body = await c.req.parseBody();
  if (body.status === "success") {
    return await bot.helpers
      .sendFollowupMessage(`${body.token}`, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: "**✅Done!**",
          embeds: [
            {
              fields: [{ name: "🔗Tweet URL", value: `> ${body.link}` }],
              color: 0x4db56a,
              timestamp: new Date().getTime(),
            },
          ],
          file: {
            blob: new Blob([await (body.file as File).arrayBuffer()], {
              type: `${body.type}`,
            }),
            name: `${body.name}`,
          },
        },
      })
      .then(() => c.text(""))
      .catch(() => c.status(500));
  } else {
    return await bot.helpers
      .sendFollowupMessage(`${body.token}`, {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: "**❌Failure!**",
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
