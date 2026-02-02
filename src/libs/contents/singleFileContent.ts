import { fileToBlob } from "@utils";
import { ContentsTypes } from "@libs/types/contentsTypes.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

/**
 * Retrieves the content of a single file from the given body data object.
 *
 * @param {CallbackTypes.bodyDataObject | null} body - The body data object containing the file information.
 * @return {Promise<ContentsTypes.singleFileContentObject>} A promise that resolves to an object containing the file name and blob data.
 * @throws {Error} If the number of files given and the number of files expected are different.
 */
const singleFileContent = async (
  body: CallbackTypes.bodyDataObject | null
): Promise<ContentsTypes.singleFileContentObject> => {
  try {
    if (body!.file1 === undefined || body!.name1 === undefined)
      throw new Error(
        "The number of files given and the number of files expected are different."
      );
    return {
      fileName: body!.name1,
      blobData: await fileToBlob(body!.file1 as File),
    };
  } catch(e: unknown) {
    throw e as Error;
  } finally {
    body = null;
  }
};

export default singleFileContent;
