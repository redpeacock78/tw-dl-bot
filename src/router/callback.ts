import { Hono } from "hono";
import { match, Pattern } from "ts-pattern";
import { Constants } from "@libs";
import { Functions } from "@router/functions/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const pattern = {
  success: {
    dl: {
      single: [
        Constants.CallbackObject.Status.SUCCESS,
        Constants.CallbackObject.commandType.DL,
        Constants.CallbackObject.actionType.SINGLE,
      ],
      multi: [
        Constants.CallbackObject.Status.SUCCESS,
        Constants.CallbackObject.commandType.DL,
        Constants.CallbackObject.actionType.MULTI,
      ],
    },
  },
  failure: [
    Constants.CallbackObject.Status.FAILURE,
    Pattern.nullish,
    Pattern.nullish,
  ],
  progress: [
    Constants.CallbackObject.Status.PROGRESS,
    Pattern.nullish,
    Pattern.nullish,
  ],
} as const;
const success = Functions.callbackSuccessFunctions.success;
const failure = Functions.callbackFailureFunctions.failure;
const progress = Functions.callbackProgressFunctions.progress;

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
      return match([body.status, body!.commandType, body!.actionType])
        .with(
          pattern.success.dl.single,
          async (): Promise<Response> => await success.dl.single({ c, body })
        )
        .with(
          pattern.success.dl.multi,
          async (): Promise<Response> => await success.dl.multi({ c, body })
        )
        .with(
          pattern.failure,
          async (): Promise<Response> => await failure({ c, body })
        )
        .with(
          pattern.progress,
          async (): Promise<Response> => await progress({ c, body })
        )
        .otherwise(
          (): Response => c.body(null, Constants.HttpStatus.BAD_REQUEST)
        );
    } finally {
      body = null;
    }
  }
);

export default callback;
