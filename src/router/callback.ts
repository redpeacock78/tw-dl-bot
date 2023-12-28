import { Hono } from "hono";
import bot from "@bot/bot.ts";
import fileToBlob from "@utils/fileToBlob.ts";
import { FileContent } from "discordeno";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callback = new Hono();

const callbackSuccessActions: CallbackTypes.Actions.callbackSuccess = {
  success: {
    dl: {
      single: async (
        c: CallbackTypes.ContextType,
        body: CallbackTypes.bodyDataObject
      ): Promise<Response> => {
        let blobData: Blob | null = await fileToBlob(body.file1 as File);
        return await bot.helpers
          .editFollowupMessage(`${body.token}`, `${body.message}`, {
            content: "**✅Done!**",
            embeds: [
              {
                fields: [
                  { name: "🎞 Video Name", value: `> \`${body.name1}\`` },
                  { name: "🔗Tweet URL", value: `> ${body.link}` },
                ],
                color: 0x4db56a,
                timestamp: new Date().getTime(),
              },
            ],
            file: {
              blob: blobData,
              name: `${body.name1}`,
            },
          })
          .then((): Response => {
            blobData = null;
            return c.body(null, 204);
          })
          .catch((e): Response => {
            console.log(e);
            blobData = null;
            return c.body(null, 500);
          });
      },
      multi: async (
        c: CallbackTypes.ContextType,
        body: CallbackTypes.bodyDataObject
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body.startTime);
        let filesArray: (string | File)[] | null = Object.keys(body)
          .filter((i: string): RegExpMatchArray | null => i.match(/file/))
          .map((i: string): string | File => {
            const key: keyof CallbackTypes.bodyDataObject =
              i as keyof CallbackTypes.bodyDataObject;
            return body[key] as string | File;
          });
        let namesArray: (string | File)[] | null = Object.keys(body)
          .filter((i: string): RegExpMatchArray | null => i.match(/name/))
          .map((i: string): string | File => {
            const key: keyof CallbackTypes.bodyDataObject =
              i as keyof CallbackTypes.bodyDataObject;
            return body[key] as string | File;
          });
        let fileContentArray: FileContent[] | null = await Promise.all(
          namesArray.map(
            async (
              i: string | File,
              n: number
            ): Promise<{
              blob: Blob;
              name: string;
            }> => {
              return {
                blob: await fileToBlob(
                  (filesArray as (string | File)[])[n] as File
                ),
                name: i as string,
              };
            }
          )
        );
        if (900000 < runTime || body.oversize === "true") {
          return await bot.helpers
            .sendMessage(`${body.channel}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    {
                      name: "🎞 Video Name",
                      value: namesArray
                        .map((i: string | File): string => `> \`${i}\``)
                        .join("\n"),
                    },
                    { name: "🔗Tweet URL", value: `> ${body.link}` },
                  ],
                  color: 0x4db56a,
                  timestamp: new Date().getTime(),
                },
              ],
              file: fileContentArray,
              messageReference: {
                messageId: `${body.message}`,
                channelId: `${body.channel}`,
                failIfNotExists: true,
              },
            })
            .then((): Response => {
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.body(null, 204);
            })
            .catch((): Response => {
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.body(null, 500);
            });
        } else {
          return await bot.helpers
            .editFollowupMessage(`${body.token}`, `${body.message}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    {
                      name: "🎞 Video Name",
                      value: namesArray
                        .map((i: string | File): string => `> \`${i}\``)
                        .join("\n"),
                    },
                    { name: "🔗Tweet URL", value: `> ${body.link}` },
                  ],
                  color: 0x4db56a,
                  timestamp: new Date().getTime(),
                },
              ],
              file: fileContentArray,
            })
            .then((): Response => {
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.body(null, 204);
            })
            .catch((): Response => {
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.body(null, 500);
            });
        }
      },
    },
  },
};

const callbackFailureAction: CallbackTypes.Actions.callbackFailure = {
  failure: async (
    c: CallbackTypes.ContextType,
    body: CallbackTypes.bodyDataObject
  ): Promise<Response> => {
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
      .then((): Response => c.body(null, 204))
      .catch((): Response => c.body(null, 500));
  },
};

callback.post("/callback", async (c: CallbackTypes.ContextType) => {
  let body: CallbackTypes.bodyDataObject | null = null;
  try {
    body = (await c.req.raw.clone().json()) as CallbackTypes.bodyDataObject;
  } catch (_e) {
    body = (await c.req.parseBody()) as CallbackTypes.bodyDataObject;
  }
  if (body.status === "success")
    return await callbackSuccessActions[body.status][body.commandType]
      [body.actionType](c, body)
      .finally((): void => {
        body = null;
      });
  if (body.status === "failure")
    return await callbackFailureAction[body.status](c, body).finally(
      (): void => {
        body = null;
      }
    );
});

export default callback;
