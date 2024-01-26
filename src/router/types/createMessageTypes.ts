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
  };
  export type failureMessageInfo = {
    messageId?: string;
    channelId?: string;
    runNumber: string;
    runTime: number;
    link: string;
    content: string;
  };
  export type progressMessageInfo = {
    runNumber?: string;
    runTime?: number;
    link: string;
    content: string;
  };
  export type errorMessageInfo = {
    messageId?: string;
    channelId?: string;
    runNumber?: string;
    description: string;
    link?: string;
  };

  export namespace SendSuccessMessage {
    export type singleObject = {
      token: string;
      channelId: string;
      messageId: string;
      runNumber: string;
      runTime: number;
      totalSize: string;
      fileName: string;
      link: string;
      file: Blob;
      editFollowupMessageFlag: boolean;
    };
  }
  export type sendErrorMessageObject = {
    token: string;
    channel: string;
    message: string;
    number: string;
    link: string;
    description: string;
    editFollowupMessageFlag: boolean;
  };
}
