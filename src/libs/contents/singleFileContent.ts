import { ContentsTypes } from "@libs/types/contentsTypes.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

/**
 * Retrieves the content of a single file from the given body data object.
 *
 * `File` extends `Blob` per the Web API spec (and Deno). The `File` objects
 * produced by Hono's `parseBody()` are already `Blob`-compatible — no
 * intermediate `ArrayBuffer` copy is needed.
 *
 * @param {CallbackTypes.bodyDataObject | null} body - The body data object containing the file information.
 * @return {Promise<ContentsTypes.singleFileContentObject>} A promise that resolves to an object containing the file name and blob data.
 * @throws {Error} If the number of files given and the number of files expected are different.
 */
const singleFileContent = (
  body: CallbackTypes.bodyDataObject | null
): Promise<ContentsTypes.singleFileContentObject> => {
  try {
    if (body!.file1 === undefined || body!.name1 === undefined)
      throw new Error(
        "The number of files given and the number of files expected are different."
      );
    return Promise.resolve({
      fileName: body!.name1,
      blobData: body!.file1 as unknown as Blob,
    });
  } catch(e: unknown) {
    return Promise.reject(e as Error);
  } finally {
    body = null;
  }
};

export default singleFileContent;
