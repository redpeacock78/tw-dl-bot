export const Constants = {
  ROOT_PATH: "/",
  BASE_PATH: "/api",
  PING_PATH: "/ping",
  CALLBACK_PATH: "/callback",
  EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT: 900000,
  UPDATE_BOT_STATUS_INTERVAL: 10000,
  SECRETS: ["DISPATCH_URL", "GITHUB_TOKEN", "DISCORD_TOKEN"],
  AppEmoji: {
    LOADING_SPINNER: "<a:loading_spinner:1403246468672000000>",
  },
  Message: {
    Color: {
      SUCCESS: 0x4db56a,
      FAILURE: 0xf1c40f,
      PROGRESS: 0x3498db,
      ERROR: 0xe74c3c,
    },
  },
  Webhook: {
    Json: {
      EVENT_TYPE: "download",
      ClientPayload: {
        CommandType: {
          DOWNLOAD: "dl",
          THREAD_DOWNLOAD: "threaddl",
        },
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
    commandType: {
      DL: "dl",
    },
    actionType: {
      SINGLE: "single",
      MULTI: "multi",
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
} as const satisfies Readonly<Record<string, unknown>>;
