// deno-lint-ignore-file no-namespace
import { Hono, Context, Env } from "hono";

export namespace CallbackTypes {
  export type bodyDataObject = {
    status: "success" | "failure" | "progress" | null;
    number: string;
    commandType?: "dl";
    actionType?: "single" | "multi";
    startTime: string;
    channel: string;
    message: string;
    token: string;
    link: string;
    convert?: "true" | "false";
    oversize?: "true" | "false";
    name1?: string;
    name2?: string;
    name3?: string;
    name4?: string;
    file1?: File;
    file2?: File;
    file3?: File;
    file4?: File;
    size?: string;
    type: string;
    content?: string;
  };

  export type honoType<T extends string> = Hono<
    Env,
    Record<string | number | symbol, never>,
    T
  >;
  export type contextType<T extends string> = Context<
    Env,
    T,
    Record<string | number | symbol, never>
  >;
  export type infoObjectType<T extends string> = {
    c: contextType<T>;
    body: bodyDataObject | null;
  };
  export namespace Functions {
    export type callbackSuccess = {
      [key: string]: {
        [key: string]: {
          [key: string]: <T extends string>(
            infoObject: infoObjectType<T>
          ) => Promise<Response>;
        };
      };
    };
    export type callbackFailure = {
      [key: string]: <T extends string>(
        infoObject: infoObjectType<T>
      ) => Promise<Response>;
    };
    export type callbackProgress = {
      [key: string]: <T extends string>(
        infoObject: infoObjectType<T>
      ) => Promise<Response>;
    };
  }
}
