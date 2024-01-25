import { fileToBlob } from "@utils";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const fileContent = async (body: CallbackTypes.bodyDataObject | null) => {
  try {
    if (body!.file1 !== undefined || typeof body!.name1 !== "string")
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

export default fileContent;
