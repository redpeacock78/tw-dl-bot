import bot from "@bot/bot.ts";
import { Constants } from "@libs";
import { FileContent } from "discordeno";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { fileToBlob, unitChangeForByte, millisecondChangeFormat } from "@utils";
import { createSuccessMessage } from "@router/messages/index.ts";

const callbackSuccessFunctions: CallbackTypes.Functions.callbackSuccess = {
  success: {
    dl: {
      single: async (
        c: CallbackTypes.contextType,
        body: CallbackTypes.bodyDataObject | null
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body!.startTime);
        const editFollowupMessageFlag: boolean =
          runTime <= Constants.UPDATE_TIME_LIMIT ||
          body!.oversize !== Constants.CallbackObject.Oversize.TRUE;
        let blobData: Blob | null = await fileToBlob(body!.file1 as File);
        if (editFollowupMessageFlag)
          return await bot.helpers
            .editFollowupMessage(
              `${body!.token}`,
              `${body!.message}`,
              createSuccessMessage({
                runNumber: body!.number,
                runTime: runTime,
                totalSize: body!.size!,
                fileName: body!.name1!,
                link: body!.link,
                file: blobData,
                editFollowupMessageFlag: editFollowupMessageFlag,
              })
            )
            .then((): Response => c.body(null, 204))
            .catch((): Response => c.body(null, 500))
            .finally((): void => {
              body = null;
              blobData = null;
            });
        return await bot.helpers
          .sendMessage(
            `${body!.channel}`,
            createSuccessMessage({
              messageId: body!.message,
              channelId: body!.channel,
              runNumber: body!.number,
              runTime: runTime,
              totalSize: body!.size!,
              fileName: body!.name1!,
              link: body!.link,
              file: blobData,
              editFollowupMessageFlag: editFollowupMessageFlag,
            })
          )
          .then((): Response => c.body(null, 204))
          .catch((): Response => c.body(null, 500))
          .finally((): void => {
            body = null;
            blobData = null;
          });
      },
      multi: async (
        c: CallbackTypes.contextType,
        body: CallbackTypes.bodyDataObject | null
      ): Promise<Response> => {
        const runTime: number = new Date().getTime() - Number(body!.startTime);
        let filesArray: (string | File)[] | null = Object.keys(body!)
          .filter((i: string): RegExpMatchArray | null => i.match(/file/))
          .map((i: string): string | File => {
            const key: keyof CallbackTypes.bodyDataObject =
              i as keyof CallbackTypes.bodyDataObject;
            return body![key] as string | File;
          });
        let namesArray: (string | File)[] | null = Object.keys(body!)
          .filter((i: string): RegExpMatchArray | null => i.match(/name/))
          .map((i: string): string | File => {
            const key: keyof CallbackTypes.bodyDataObject =
              i as keyof CallbackTypes.bodyDataObject;
            return body![key] as string | File;
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
          body!.oversize === Constants.CallbackObject.Oversize.TRUE
        )
          return await bot.helpers
            .sendMessage(`${body!.channel}`, {
              content: "**✅Done!**",
              embeds: [
                {
                  fields: [
                    { name: "#️⃣ Run Number", value: `> \`#${body!.number}\`` },
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
                      value: `> \`${unitChangeForByte(body!.size!)}\``,
                      inline: true,
                    },
                    { name: "🔗 Tweet URL", value: `> ${body!.link}` },
                  ],
                  color: 0x4db56a,
                  timestamp: new Date().getTime(),
                },
              ],
              file: fileContentArray,
              messageReference: {
                messageId: `${body!.message}`,
                channelId: `${body!.channel}`,
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
        return await bot.helpers
          .editFollowupMessage(`${body!.token}`, `${body!.message}`, {
            content: "**✅Done!**",
            embeds: [
              {
                fields: [
                  { name: "#️⃣ Run Number", value: `> \`#${body!.number}\`` },
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
                    value: `> \`${unitChangeForByte(body!.size!)}\``,
                    inline: true,
                  },
                  { name: "🔗 Tweet URL", value: `> ${body!.link}` },
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
      },
    },
  },
};

export default callbackSuccessFunctions;
