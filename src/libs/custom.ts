import { P } from "functional";
import { Constants } from "@libs";

export const Custom = {
  CallbackPattern: {
    Success: {
      Dl: {
        Single: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.DL,
          Constants.CallbackObject.actionType.SINGLE,
        ],
        Multi: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.DL,
          Constants.CallbackObject.actionType.MULTI,
        ],
      },
      DlSpoiler: {
        Single: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.DL_SPOILER,
          Constants.CallbackObject.actionType.SINGLE,
        ],
        Multi: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.DL_SPOILER,
          Constants.CallbackObject.actionType.MULTI,
        ],
      },
      ThreadDl: {
        Single: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.THREAD_DL,
          Constants.CallbackObject.actionType.THREAD_SINGLE,
        ],
        Multi: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.THREAD_DL,
          Constants.CallbackObject.actionType.THREAD_MULTI,
        ],
      },
      ThreadDlSpoiler: {
        Single: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.THREAD_DL_SPOILER,
          Constants.CallbackObject.actionType.THREAD_SINGLE,
        ],
        Multi: [
          Constants.CallbackObject.Status.SUCCESS,
          Constants.CallbackObject.commandType.THREAD_DL_SPOILER,
          Constants.CallbackObject.actionType.THREAD_MULTI,
        ],
      },
    },
    FailureThread: [
      Constants.CallbackObject.Status.FAILURE,
      Constants.CallbackObject.commandType.THREAD_DL,
      P.nullish,
    ],
    FailureThreadSpoiler: [
      Constants.CallbackObject.Status.FAILURE,
      Constants.CallbackObject.commandType.THREAD_DL_SPOILER,
      P.nullish,
    ],
    ProgressThread: [
      Constants.CallbackObject.Status.PROGRESS,
      Constants.CallbackObject.commandType.THREAD_DL,
      P.nullish,
    ],
    ProgressThreadSpoiler: [
      Constants.CallbackObject.Status.PROGRESS,
      Constants.CallbackObject.commandType.THREAD_DL_SPOILER,
      P.nullish,
    ],
    Failure: [Constants.CallbackObject.Status.FAILURE, P.nullish, P.nullish],
    Progress: [Constants.CallbackObject.Status.PROGRESS, P.nullish, P.nullish],
    InvalidPost: [P.nullish, P.nullish, P.nullish],
  },
} as const;
