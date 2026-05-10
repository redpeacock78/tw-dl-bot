import { ContentsTypes } from "@libs/types/contentsTypes.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { FileContent } from "discordeno";

/**
 * Retrieves the content of multiple files from the given body data object.
 *
 * `File` extends `Blob` per the Web API spec (and Deno). The `File` objects
 * produced by Hono's `parseBody()` are already `Blob`-compatible — no
 * intermediate `ArrayBuffer` copy is needed.
 *
 * @param {CallbackTypes.bodyDataObject | null} body - The body data object containing the file information.
 * @return {Promise<ContentsTypes.multiFilesContentObject>} A promise that resolves to an object containing the file names and blob data.
 * @throws {Error} If the number of files given and the number of files expected are different.
 */
const multiFilesContent = async (
  body: CallbackTypes.bodyDataObject | null,
): Promise<ContentsTypes.multiFilesContentObject> => {
  let namesArray: string[] | null = Object.keys(body!).filter(
    (i: string): RegExpMatchArray | null => i.match(/^name[0-9].*$/),
  );
  let filesArray: string[] | null = Object.keys(body!).filter(
    (i: string): RegExpMatchArray | null => i.match(/^file[0-9].*$/),
  );
  const multiFilesContentErrorFlag =
    namesArray.length !== filesArray.length ||
    namesArray.length === 0 ||
    filesArray.length === 0;
  try {
    if (multiFilesContentErrorFlag)
      throw new Error(
        "The number of files given and the number of files expected are different.",
      );
    return {
      fileNamesArray: namesArray.map(
        (i: string): string =>
          body![i as keyof CallbackTypes.bodyDataObject] as string,
      ),
      filesArray: await Promise.all(
        [...new Array(namesArray.length)].map(
          (_i: string, n: number): FileContent => {
            return {
              name: body![
                (namesArray as string[])[
                  n
                ] as keyof CallbackTypes.bodyDataObject
              ] as string,
              blob: body![
                (filesArray as string[])[
                  n
                ] as keyof CallbackTypes.bodyDataObject
              ] as unknown as Blob,
            };
          },
        ),
      ),
    };
  } catch (e: unknown) {
    throw e as Error;
  } finally {
    body = null;
    namesArray = null;
    filesArray = null;
  }
};

export default multiFilesContent;
