import { Hono } from "hono";
import { Function, Either, Option, TaskEither, Match } from "functional";
import { Functions } from "@router/functions/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { Constants, Custom } from "@libs";

type O<A> = Option.Option<A>;
type E<E, A> = Either.Either<E, A>;
type BodyDataObject = CallbackTypes.bodyDataObject;
type BodyDataObjectUnitNull = BodyDataObject | null;
type RootPath = typeof Constants.ROOT_PATH;
type CallbackPath = typeof Constants.CALLBACK_PATH;
type HonoType<T extends string> = CallbackTypes.honoType<T>;
type ContentType<T extends string> = CallbackTypes.contextType<T>;

const badRequst = Constants.HttpStatus.BAD_REQUEST;
const serverError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;

const callbackPath = Constants.CALLBACK_PATH;
const callbackPattern = Custom.CallbackPattern;

const callback: HonoType<RootPath> = new Hono();

callback.post(
  callbackPath,
  async (c: ContentType<CallbackPath>): Promise<Response> => {
    const data: E<
      Promise<BodyDataObject>,
      BodyDataObject
    > = await TaskEither.tryCatch(
      async (): Promise<BodyDataObject> =>
        (await c.req.raw.clone().json()) as BodyDataObject,
      async (): Promise<BodyDataObject> =>
        (await c.req.parseBody()) as BodyDataObject
    )();
    let body: BodyDataObjectUnitNull = await Match(Either.isRight(data))
      .with(
        true,
        (): BodyDataObjectUnitNull =>
          Function.pipe(
            Option.getRight(data),
            (rightValue: O<BodyDataObject>): BodyDataObjectUnitNull =>
              Option.isSome(rightValue) ? rightValue.value : null
          )
      )
      .with(
        false,
        (): Promise<BodyDataObjectUnitNull> =>
          Function.pipe(
            Option.getLeft(data),
            async (
              leftValue: O<Promise<BodyDataObject>>
            ): Promise<BodyDataObjectUnitNull> =>
              Option.isSome(leftValue) ? await leftValue.value : null
          )
      )
      .exhaustive();
    const patternArray = [body!.status, body!.commandType, body!.actionType];
    return await Match(patternArray)
      .with(
        callbackPattern.Success.Dl.Single,
        (): Promise<Response> =>
          Functions.callbackSuccessFunctions.success.dl.single({ c, body })
      )
      .with(
        callbackPattern.Success.Dl.Multi,
        (): Promise<Response> =>
          Functions.callbackSuccessFunctions.success.dl.multi({ c, body })
      )
      .with(
        callbackPattern.Progress,
        (): Promise<Response> =>
          Functions.callbackProgressFunctions.progress({ c, body })
      )
      .with(
        callbackPattern.Failure,
        (): Promise<Response> =>
          Functions.callbackFailureFunctions.failure({ c, body })
      )
      .with(
        callbackPattern.InvalidPost,
        (): Promise<Response> => Promise.resolve(c.body(null, badRequst))
      )
      .otherwise(
        (): Promise<Response> => Promise.resolve(c.body(null, serverError))
      )
      .finally((): null => (body = null));
  }
);

export default callback;
