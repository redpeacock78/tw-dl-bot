import { Hono } from "hono";
import { Secrets } from "@libs/secrets.ts";
import bot from "@bot/bot.ts";
import { InteractionResponseTypes } from "discordeno";

const callback = new Hono();

callback.post("/callback", async (c): Promise<void | Response> => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([await file.arrayBuffer()], { type: body.type as string }),
    body.name as string
  );
  formData.append(
    "payload_json",
    JSON.stringify({
      content: "✅Done!",
      message_reference: { message_id: body.message },
    })
  );
  if (body.status === "success") {
    return bot.helpers
      .sendInteractionResponse(body.message as string, body.channel as string, {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          content: `✅Done!`,
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
    return await fetch(
      `https://discord.com/api/channels/${body.channel}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${Secrets.DISCORD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "❌Failure!",
          embeds: [
            {
              description: `> ${body.link}\n${body.content}`,
              color: 0x4db56a,
              timestamp: new Date(),
            },
          ],
          message_reference: { message_id: body.message },
        }),
      }
    )
      .then(() => c.text(""))
      .catch(() => c.status(500));
  }
});

export default callback;
