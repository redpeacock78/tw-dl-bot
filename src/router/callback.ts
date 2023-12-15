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
      ): Promise<void> => {
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
          .then((): void => {
            blobData = null;
            return c.status(204);
          })
          .catch((): void => {
            blobData = null;
            return c.status(500);
          });
      },
      multi: async (
        c: CallbackTypes.ContextType,
        body: CallbackTypes.bodyDataObject
      ): Promise<void> => {
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
        if (900000 < runTime || body.convert === "true") {
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
            .then((i): void => {
              console.log(i);
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.status(204);
            })
            .catch((e): void => {
              console.log(e);
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.status(500);
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
            .then((i): void => {
              console.log(i);
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.status(204);
            })
            .catch((e): void => {
              console.log(e);
              filesArray = null;
              namesArray = null;
              fileContentArray = null;
              return c.status(500);
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
  ): Promise<void> => {
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
      .then((): void => c.status(204))
      .catch((): void => c.status(500));
  },
};

callback.post("/callback", async (c: CallbackTypes.ContextType) => {
  let body: CallbackTypes.bodyDataObject | null =
    (await c.req.parseBody()) as CallbackTypes.bodyDataObject;
  if (body.status === "success") {
    return await callbackSuccessActions[body.status][body.commandType]
      [body.actionType](c, body)
      .finally((): null => (body = null));
  } else {
    return await callbackFailureAction
      .failure(c, body)
      .finally((): null => (body = null));
  }
});

export default callback;
