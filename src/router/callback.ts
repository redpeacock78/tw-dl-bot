import { Hono } from "hono";
import { Constants } from "@libs";
import {
  callbackSuccessFunctions,
  callbackFailureFunctions,
  callbackProgressFunctions,
} from "@router/functions/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callback = new Hono();

callback.post(
  "/callback",
  async (c: CallbackTypes.ContextType): Promise<Response | undefined> => {
    let body: CallbackTypes.bodyDataObject | null = null;
    try {
      body = (await c.req.raw.clone().json()) as CallbackTypes.bodyDataObject;
    } catch (_e) {
      body = (await c.req.parseBody()) as CallbackTypes.bodyDataObject;
    }
    if (body.status === Constants.CallbackObject.Status.SUCCESS)
      return await callbackSuccessFunctions[body.status][body.commandType!]
        [body.actionType!](c, body)
        .finally((): void => {
          body = null;
        });
    if (body.status === Constants.CallbackObject.Status.FAILURE)
      return await callbackFailureFunctions[body.status](c, body).finally(
        (): void => {
          body = null;
        }
      );
    if (body.status === Constants.CallbackObject.Status.PROGRESS)
      return await callbackProgressFunctions[body.status](c, body).finally(
        (): void => {
          body = null;
        }
      );
    body = null;
    return c.body(null, 200);
  }
);

export default callback;
