// deno-lint-ignore-file no-namespace
import { FileContent } from "discordeno";

export namespace ContentsTypes {
  export type singleFileContentObject = {
    fileName: string;
    blobData: Blob;
  };
  export type multiFilesContentObject = {
    fileNamesArray: string[];
    filesArray: FileContent[];
  };
}
