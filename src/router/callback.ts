import { Hono } from "hono";
import bot from "@bot/bot.ts";
import fileToBlob from "@utils/fileToBlob.ts";
import { BodyData } from "hono-utils-body";

const callback = new Hono();

callback.post("/callback", async (c): Promise<void> => {
  let body: BodyData | null = await c.req.parseBody();
  if (body.status === "success") {
    let blobData: Blob | null = await fileToBlob(body.file as File);
    console.log(body);
    return await bot.helpers
      .editFollowupMessage(`${body.token}`, `${body.message}`, {
        content: "**✅Done!**",
        embeds: [
          {
            fields: [
              { name: "🎞 Video Name", value: `> \`\`\`${body.name}\`\`\`` },
              { name: "🔗Tweet URL", value: `> ${body.link}` },
            ],
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
        file: {
          blob: blobData,
          name: `${body.name}`,
        },
      })
      .then((): void => {
        console.log("OK");
        body = null;
        blobData = null;
        return c.status(204);
      })
      .catch((e): void => {
        console.log("NG");
        console.log(e);
        body = null;
        blobData = null;
        return c.status(500);
      });
  } else {
    return await bot.helpers
      .editFollowupMessage(`${body.token}`, `${body.message}`, {
        content: "**❌Failure!**",
        embeds: [
          {
            description: `> ${body.link}\n${body.content}`,
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
      })
      .then((): void => {
        body = null;
        return c.status(204);
      })
      .catch((): void => {
        body = null;
        return c.status(500);
      });
  }
});

export default callback;
