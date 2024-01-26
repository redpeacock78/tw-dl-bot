import { fileToBlob } from "@utils";
import { ContentsTypes } from "@libs/types/contentsTypes.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

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
  } finally {
    body = null;
  }
};

export default singleFileContent;
