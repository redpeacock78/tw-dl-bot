import { Hono } from "hono";
import bot from "@bot/bot.ts";
import { FileContent } from "discordeno";
import { Constants } from "@libs";
import { fileToBlob, unitChangeForByte, millisecondChangeFormat } from "@utils";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callback = new Hono();

const callbackSuccessActions: CallbackTypes.Actions.callbackSuccess = {
  success: {
    dl: {
      single: async (
        c: CallbackTypes.ContextType,
        body: CallbackTypes.bodyDataObject
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body.startTime);
        let blobData: Blob | null = await fileToBlob(body.file1 as File);
        if (
          Constants.UPDATE_TIME_LIMIT < runTime ||
          body.oversize === Constants.CallbackObject.Oversize.TRUE
        ) {
          return await bot.helpers
            .sendMessage(`${body.channel}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
                    {
                      name: "🕑 Total Time",
                      value: `> \`${millisecondChangeFormat(runTime)}\``,
                    },
                    {
                      name: "🎞 Video Name",
                      value: `> \`${body.name1}\``,
                      inline: true,
                    },
                    {
                      name: "📂 Total File Size",
                      value: `> \`${unitChangeForByte(body.size!)}\``,
                      inline: true,
                    },
                    { name: "🔗 Tweet URL", value: `> ${body.link}` },
                  ],
                  color: 0x4db56a,
                  timestamp: new Date().getTime(),
                },
              ],
              file: {
                blob: blobData,
                name: `${body.name1}`,
              },
              messageReference: {
                messageId: `${body.message}`,
                channelId: `${body.channel}`,
                failIfNotExists: true,
              },
            })
            .then((): Response => {
              blobData = null;
              return c.body(null, 204);
            })
            .catch((): Response => {
              blobData = null;
              return c.body(null, 500);
            });
        } else {
          return await bot.helpers
            .editFollowupMessage(`${body.token}`, `${body.message}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
                    {
                      name: "🕑 Total Time",
                      value: `> \`${millisecondChangeFormat(runTime)}\``,
                    },
                    {
                      name: "🎞 Video Name",
                      value: `> \`${body.name1}\``,
                      inline: true,
                    },
                    {
                      name: "📂 Total File Size",
                      value: `> \`${unitChangeForByte(body.size!)}\``,
                      inline: true,
                    },
                    { name: "🔗 Tweet URL", value: `> ${body.link}` },
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
            .catch((): Response => {
              blobData = null;
              return c.body(null, 500);
            });
        }
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
        if (
          Constants.UPDATE_TIME_LIMIT < runTime ||
          body.oversize === Constants.CallbackObject.Oversize.TRUE
        ) {
          return await bot.helpers
            .sendMessage(`${body.channel}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
                    {
                      name: "🕑 Total Time",
                      value: `> \`${millisecondChangeFormat(runTime)}\``,
                    },
                    {
                      name: "🎞 Video Names",
                      value: namesArray
                        .map((i: string | File): string => `> \`${i}\``)
                        .join("\n"),
                      inline: true,
                    },
                    {
                      name: "📂 Total File Size",
                      value: `> \`${unitChangeForByte(body.size!)}\``,
                      inline: true,
                    },
                    { name: "🔗 Tweet URL", value: `> ${body.link}` },
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
                    { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
                    {
                      name: "🕑 Total Time",
                      value: `> \`${millisecondChangeFormat(runTime)}\``,
                    },
                    {
                      name: "🎞 Video Names",
                      value: namesArray
                        .map((i: string | File): string => `> \`${i}\``)
                        .join("\n"),
                      inline: true,
                    },
                    {
                      name: "📂 Total File Size",
                      value: `> \`${unitChangeForByte(body.size!)}\``,
                      inline: true,
                    },
                    { name: "🔗 Tweet URL", value: `> ${body.link}` },
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
            fields: [
              { name: "#️⃣ Run Number", value: `> \`#${body.number}\`` },
              {
                name: "🕑 Total Time",
                value: `> \`${millisecondChangeFormat(
                  new Date().getTime() - Number(body.startTime)
                )}\``,
              },
              { name: "🔗 Tweet URL", value: `> ${body.link}` },
            ],
            description: body.content,
            color: 0x4db56a,
            timestamp: new Date().getTime(),
          },
        ],
      })
      .then((): Response => c.body(null, 204))
      .catch((): Response => c.body(null, 500));
  },
};

const callbackProgressAction: CallbackTypes.Actions.callbackProgress = {
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

callback.post(
  "/callback",
  async (c: CallbackTypes.ContextType): Promise<Response | undefined> => {
    let body: CallbackTypes.bodyDataObject | null = null;
    try {
      body = (await c.req.raw.clone().json()) as CallbackTypes.bodyDataObject;
    } catch (_e) {
      body = (await c.req.parseBody()) as CallbackTypes.bodyDataObject;
    }
    if (body.status === Constants.CallbackObject.Status.SUCCESS)
      return await callbackSuccessActions[body.status][body.commandType!]
        [body.actionType!](c, body)
        .finally((): void => {
          body = null;
        });
    if (body.status === Constants.CallbackObject.Status.FAILURE)
      return await callbackFailureAction[body.status](c, body).finally(
        (): void => {
          body = null;
        }
      );
    if (body.status === Constants.CallbackObject.Status.PROGRESS)
      return await callbackProgressAction[body.status](c, body).finally(
        (): void => {
          body = null;
        }
      );
    body = null;
    return c.body(null, 200);
  }
);

export default callback;
