import { Constants } from "@libs";
import { CreateSlashApplicationCommand } from "discordeno";

type CommandsType = {
  dlCommand: CreateSlashApplicationCommand;
  dlSpoilerCommand: CreateSlashApplicationCommand;
  threadDlCommand: CreateSlashApplicationCommand;
  threadDlSpoilerCommand: CreateSlashApplicationCommand;
};

export const Commands: CommandsType = {
  dlCommand: {
    name: Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD,
    description: "Download tweet video",
    type: 1,
    options: [
      {
        name: "url",
        type: 3,
        required: true,
        description: "Tweet URL",
      },
    ],
  },
  dlSpoilerCommand: {
    name: Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD_SPOILER,
    description: "Download tweet video with spoiler",
    type: 1,
    options: [
      {
        name: "url",
        type: 3,
        required: true,
        description: "Tweet URL",
      },
    ],
  },
  // NOTE: `/threaddl` and `/threaddl-spoiler` are Modal-based commands.
  // The `url` option used to live here, but URLs are now collected from a
  // Discord Modal (Paragraph TextInput, one URL per line) so users can paste
  // many URLs without worrying about quoting/escaping.
  // The slash command itself only takes `name` (the thread title), and the
  // bot opens the Modal as the immediate interaction response.
  //
  // `dmPermission: false` hides both commands from DM autocomplete. Thread
  // creation requires a guild text channel — there is no valid DM use-case.
  // discordeno v18 exposes `dmPermission` from the Discord API v10
  // `CreateSlashApplicationCommand` shape. The newer `contexts` field (Discord
  // API v10 addition) is not yet present in this version's type; `dmPermission`
  // achieves the same result and is still honoured by all current clients.
  threadDlCommand: {
    name: Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD,
    description: "DL multiple Tweets into a thread",
    type: 1,
    dmPermission: false,
    options: [
      {
        name: "name",
        type: 3,
        required: true,
        description: "Thread Name",
      },
    ],
  },
  threadDlSpoilerCommand: {
    name:
      Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD_SPOILER,
    description: "DL multiple Tweets into a thread with spoiler",
    type: 1,
    dmPermission: false,
    options: [
      {
        name: "name",
        type: 3,
        required: true,
        description: "Thread Name",
      },
    ],
  },
};
