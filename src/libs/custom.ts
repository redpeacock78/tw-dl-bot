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
    },
    Failure: [Constants.CallbackObject.Status.FAILURE, P.nullish, P.nullish],
    Progress: [Constants.CallbackObject.Status.PROGRESS, P.nullish, P.nullish],
    InvalidPost: [P.nullish, P.nullish, P.nullish],
  },
} as const;
