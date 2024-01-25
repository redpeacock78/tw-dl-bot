export const Constants = {
  ROOT_PATH: "/",
  BASE_PATH: "/api",
  PING_PATH: "/ping",
  CALLBACK_PATH: "/callback",
  EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT: 900000,
  Webhook: {
    Json: {
      EVENT_TYPE: "download",
      ClientPayload: {
        COMMAND_TYPE: "dl",
      },
    },
    Headers: {
      ACCEPT: "application/vnd.github.everest-preview+json",
    },
  },
  CallbackObject: {
    Status: {
      SUCCESS: "success",
      FAILURE: "failure",
      PROGRESS: "progress",
    },
    Oversize: {
      TRUE: "true",
      FALSE: "false",
    },
  },
  HttpStatus: {
    OK: 200,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
  },
};
