import { fileToBlob } from "@utils";
import { FileContent } from "discordeno";
import { ContentsTypes } from "@libs/types/contentsTypes.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const multiFilesContent = async (
  body: CallbackTypes.bodyDataObject | null
): Promise<ContentsTypes.multiFilesContentObject> => {
  let namesArray: string[] | null = Object.keys(body!).filter(
    (i: string): RegExpMatchArray | null => i.match(/^name[0-9].*$/)
  );
  let filesArray: string[] | null = Object.keys(body!).filter(
    (i: string): RegExpMatchArray | null => i.match(/^file[0-9].*$/)
  );
  const multiFilesContentErrorFlag =
    namesArray.length !== filesArray.length ||
    namesArray.length === 0 ||
    filesArray.length === 0;
  try {
    if (multiFilesContentErrorFlag)
      throw new Error(
        "The number of files given and the number of files expected are different."
      );
    return {
      fileNamesArray: namesArray.map(
        (i: string): string =>
          body![i as keyof CallbackTypes.bodyDataObject] as string
      ),
      filesArray: await Promise.all(
        [...new Array(namesArray.length)].map(
          async (_i: string, n: number): Promise<FileContent> => {
            return {
              name: body![
                (namesArray as string[])[
                  n
                ] as keyof CallbackTypes.bodyDataObject
              ] as string,
              blob: await fileToBlob(
                body![
                  (filesArray as string[])[
                    n
                  ] as keyof CallbackTypes.bodyDataObject
                ] as File
              ),
            };
          }
        )
      ),
    };
  } finally {
    body = null;
    namesArray = null;
    filesArray = null;
  }
};

export default multiFilesContent;
