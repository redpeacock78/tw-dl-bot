// deno-lint-ignore-file no-namespace
import { Context, Env } from "hono";

export namespace CallbackTypes {
  export type bodyDataObject = {
    status: "success" | "failure";
    commandType: "dl";
    actionType: "single" | "multi";
    channel: string;
    message: string;
    token: string;
    link: string;
    convert: "true" | "false";
    name1: string;
    name2?: string;
    name3?: string;
    name4?: string;
    file1: File;
    file2?: File;
    file3?: File;
    file4?: File;
    type: string;
    content?: string;
  };
  export type ContextType = Context<
    Env,
    "/callback",
    Record<string | number | symbol, never>
  >;
  export namespace Actions {
    export type callbackSuccess = {
      [key: string]: {
        [key: string]: {
          [key: string]: (
            c: ContextType,
            body: CallbackTypes.bodyDataObject
          ) => Promise<void>;
        };
      };
    };
    export type callbackFailure = {
      [key: string]: (
        c: ContextType,
        body: CallbackTypes.bodyDataObject
      ) => Promise<void>;
    };
  }
}
