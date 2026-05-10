export const Constants = {
  ROOT_PATH: "/",
  BASE_PATH: "/api",
  PING_PATH: "/ping",
  CALLBACK_PATH: "/callback",
  DISCORD_API_BASE: "https://discord.com/api/v10",
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
    Content: {
      Status: {
        SUCCESS: "**✅Done!**",
        FAILURE: "**❌Failure!**",
        ERROR: "**⚠️Error!**",
      },
    },
    Embeds: {
      Fields: {
        Names: {
          RUN_NUMBER: "#️⃣ Run Number",
          TOTAL_TIME: "🕑 Total Time",
          ELAPSED_TIME: "🕑 Elapsed Times",
          VIDEO_NAME: "🎞 Video Name",
          FILE_SIZE: "📂 File Size",
          TOTAL_FILE_SIZE: "📂 Total File Size",
          SOURCE_URL: "🔗 Source URL",
        },
      },
    },
    File: {
      Name: {
        SPOILER_PREFIX: "SPOILER_",
      },
    },
  },
  Webhook: {
    Json: {
      EVENT_TYPE: "download",
      EVENT_TYPE_THREAD: "thread-download",
      ClientPayload: {
        CommandType: {
          DOWNLOAD: "dl",
          DOWNLOAD_SPOILER: "dl-spoiler",
          THREAD_DOWNLOAD: "threaddl",
          THREAD_DOWNLOAD_SPOILER: "threaddl-spoiler",
        },
      },
    },
    Headers: {
      ACCEPT: "application/vnd.github.everest-preview+json",
    },
  },
  Thread: {
    AUTO_ARCHIVE_DURATION: 1440,
    TYPE: 11,
  },
  CallbackObject: {
    Status: {
      SUCCESS: "success",
      FAILURE: "failure",
      PROGRESS: "progress",
    },
    commandType: {
      DL: "dl",
      DL_SPOILER: "dl-spoiler",
      THREAD_DL: "threaddl",
      THREAD_DL_SPOILER: "threaddl-spoiler",
    },
    actionType: {
      SINGLE: "single",
      MULTI: "multi",
      THREAD_SINGLE: "thread-single",
      THREAD_MULTI: "thread-multi",
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
