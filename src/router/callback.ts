import { Hono } from "hono";
import { Secrets } from "@libs/secrets.ts";

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
    return await fetch(
      `https://discord.com/api/channels/${body.channel}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${Secrets.DISCORD_TOKEN}`,
        },
        body: formData,
      }
    )
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
