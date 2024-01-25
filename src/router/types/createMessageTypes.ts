// deno-lint-ignore-file no-namespace
import { FileContent } from "discordeno";

export namespace CreateMessageTypes {
  export type successMessageInfo = {
    messageId?: string;
    channelId?: string;
    runNumber: string;
    runTime: number;
    totalSize: string;
    fileName?: string;
    fileNamesArray?: string[];
    link: string;
    file?: Blob;
    filesArray?: FileContent[];
    editFollowupMessageFlag: boolean;
  };
  export type failureMessageInfo = {
    messageId?: string;
    channelId?: string;
    runNumber: string;
    runTime: number;
    link: string;
    content: string;
    editFollowupMessageFlag: boolean;
  };
  export type progressMessageInfo = {
    runNumber?: string;
    runTime?: number;
    link: string;
    content: string;
  };
  export type errorMessageInfo = {
    runNumber?: string;
    description: string;
    link?: string;
  };
}
