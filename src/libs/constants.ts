export const Constants = {
  ROOT_PATH: "/" as const,
  BASE_PATH: "/api" as const,
  PING_PATH: "/ping" as const,
  CALLBACK_PATH: "/callback" as const,
  EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT: 900000 as const,
  Message: {
    Color: {
      SUCCESS: 0x4db56a as const,
      FAILURE: 0xf1c40f as const,
      PROGRESS: 0x3498db as const,
      ERROR: 0xe74c3c as const,
    },
  },
  Webhook: {
    Json: {
      EVENT_TYPE: "download" as const,
      ClientPayload: {
        COMMAND_TYPE: "dl" as const,
      },
    },
    Headers: {
      ACCEPT: "application/vnd.github.everest-preview+json" as const,
    },
  },
  CallbackObject: {
    Status: {
      SUCCESS: "success" as const,
      FAILURE: "failure" as const,
      PROGRESS: "progress" as const,
    },
    commandType: {
      DL: "dl" as const,
    },
    actionType: {
      SINGLE: "single" as const,
      MULTI: "multi" as const,
    },
    Oversize: {
      TRUE: "true" as const,
      FALSE: "false" as const,
    },
  },
  HttpStatus: {
    OK: 200 as const,
    NO_CONTENT: 204 as const,
    BAD_REQUEST: 400 as const,
    INTERNAL_SERVER_ERROR: 500 as const,
  },
};
