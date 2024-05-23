import { Constants } from "@libs";
import { Pattern } from "ts-pattern";

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
    },
    Failure: [
      Constants.CallbackObject.Status.FAILURE,
      Pattern.nullish,
      Pattern.nullish,
    ],
    Progress: [
      Constants.CallbackObject.Status.PROGRESS,
      Pattern.nullish,
      Pattern.nullish,
    ],
  },
} as const;
