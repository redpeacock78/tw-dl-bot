import { Hono, Context, Env } from "hono";
import bot from "@bot/bot.ts";
import fileToBlob from "@utils/fileToBlob.ts";
import { BodyData } from "hono-utils-body";
import { FileContent } from "discordeno";

const callback = new Hono();

type bodyDataObject = {
  status: string;
  commandType: "dl";
  actionType: "single" | "multi";
  channel: string;
  message: string;
  token: string;
  link: string;
  name: string;
  name1?: string;
  name2?: string;
  name3?: string;
  name4?: string;
  file: File;
  file1?: File;
  file2?: File;
  file3?: File;
  file4?: File;
  type: string;
  content?: string;
};

type callbackSuccessActionsObject = {
  [key: string]: {
    [key: string]: {
      [key: string]: (
        c: Context<Env, "/callback", Record<string | number | symbol, never>>,
        body: BodyData
      ) => Promise<void>;
    };
  };
};

const callbackSuccessActions: callbackSuccessActionsObject = {
  success: {
    dl: {
      single: async (
        c: Context<Env, "/callback", Record<string | number | symbol, never>>,
        body: BodyData
      ): Promise<void> => {
        let blobData: Blob | null = await fileToBlob(body.file as File);
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
            blobData = null;
            return c.status(204);
          })
          .catch((): void => {
            blobData = null;
            return c.status(500);
          });
      },
      multi: async (
        c: Context<Env, "/callback", Record<string | number | symbol, never>>,
        body: BodyData
      ): Promise<void> => {
        let filesArray: (string | File)[] | null = Object.keys(body)
          .filter((i: string): RegExpMatchArray | null => i.match(/^file/))
          .sort()
          .map((i: string): string | File => (body as BodyData)[i]);
        let namesArray: (string | File)[] | null = Object.keys(body)
          .filter((i: string): RegExpMatchArray | null => i.match(/^name/))
          .sort()
          .map((i: string): string | File => (body as BodyData)[i]);
        let fileContentArray: FileContent[] | null = await Promise.all(
          namesArray.map(async (i, n) => {
            return {
              blob: await fileToBlob(
                (filesArray as (string | File)[])[n] as File
              ),
              name: i as string,
            };
          })
        );
        return await bot.helpers
          .editFollowupMessage(`${body.token}`, `${body.message}`, {
            content: "**✅Done!**",
            embeds: [
              {
                fields: [
                  {
                    name: "🎞 Video Name",
                    value: `> \`\`\`${namesArray.join("\n")}\`\`\``,
                  },
                  { name: "🔗Tweet URL", value: `> ${body.link}` },
                ],
                color: 0x4db56a,
                timestamp: new Date().getTime(),
              },
            ],
            file: fileContentArray,
          })
          .then((): void => {
            filesArray = null;
            namesArray = null;
            fileContentArray = null;
            return c.status(204);
          })
          .catch((): void => {
            filesArray = null;
            namesArray = null;
            fileContentArray = null;
            return c.status(500);
          });
      },
    },
  },
};

const callbackFailureAction: {
  [key: string]: (
    c: Context<Env, "/callback", Record<string | number | symbol, never>>,
    body: BodyData
  ) => Promise<void>;
} = {
  failure: async (
    c: Context<Env, "/callback", Record<string | number | symbol, never>>,
    body: BodyData
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

callback.post(
  "/callback",
  async (
    c: Context<Env, "/callback", Record<string | number | symbol, never>>
  ): Promise<void> => {
    let body: bodyDataObject | null =
      (await c.req.parseBody()) as bodyDataObject;
    return body.status === "success"
      ? await callbackSuccessActions[body.status][body.commandType]
          [body.actionType](c, body)
          .finally((): null => (body = null))
      : await callbackFailureAction[body.status](c, body).finally(
          (): null => (body = null)
        );
  }
);

export default callback;
