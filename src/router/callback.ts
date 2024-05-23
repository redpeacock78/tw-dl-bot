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
    return match([body.status, body!.commandType, body!.actionType])
      .with(
        pattern.success.dl.single,
        async (): Promise<Response> =>
          await Functions.callbackSuccessFunctions.success.dl
            .single({ c, body })
            .finally((): null => (body = null))
      )
      .with(
        pattern.success.dl.multi,
        async (): Promise<Response> =>
          await Functions.callbackSuccessFunctions.success.dl
            .multi({ c, body })
            .finally((): null => (body = null))
      )
      .with(
        pattern.failure,
        async (): Promise<Response> =>
          await Functions.callbackFailureFunctions
            .failure({ c, body })
            .finally((): null => (body = null))
      )
      .with(
        pattern.progress,
        async (): Promise<Response> =>
          await Functions.callbackProgressFunctions
            .progress({ c, body })
            .finally((): null => (body = null))
      )
      .otherwise(
        (): Promise<Response> =>
          Promise.resolve(
            c.body(null, Constants.HttpStatus.BAD_REQUEST)
          ).finally((): null => (body = null))
      );
  }
);

export default callback;
