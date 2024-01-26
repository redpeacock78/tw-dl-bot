import { Hono } from "hono";
import { Constants } from "@libs";
import { Functions } from "@router/functions/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const callback: CallbackTypes.honoType<"/"> = new Hono();

callback.post(
  Constants.CALLBACK_PATH,
  async (
    c: CallbackTypes.contextType<typeof Constants.CALLBACK_PATH>
  ): Promise<Response> => {
    let body: CallbackTypes.bodyDataObject | null = null;
    try {
      body = (await c.req.raw.clone().json()) as CallbackTypes.bodyDataObject;
    } catch (_e) {
      body = (await c.req.parseBody()) as CallbackTypes.bodyDataObject;
    }
    try {
      if (body.status === Constants.CallbackObject.Status.SUCCESS)
        return await Functions.callbackSuccessFunctions.success[
          body.commandType!
        ][body.actionType!]({ c, body });
      if (body.status === Constants.CallbackObject.Status.FAILURE)
        return await Functions.callbackFailureFunctions.failure({ c, body });
      if (body.status === Constants.CallbackObject.Status.PROGRESS)
        return await Functions.callbackProgressFunctions.progress({ c, body });
      return c.body(null, Constants.HttpStatus.BAD_REQUEST);
    } finally {
      body = null;
    }
  }
);

export default callback;
