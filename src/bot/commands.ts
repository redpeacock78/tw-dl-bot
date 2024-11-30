import { Constants } from "@libs";
import { CreateSlashApplicationCommand } from "discordeno";

type CommandsType = {
  dlCommand: CreateSlashApplicationCommand;
  threadDlCommand: CreateSlashApplicationCommand;
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
  threadDlCommand: {
    name: Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD,
    description: "DL multiple Tweets into a thread",
    type: 1,
    options: [
      {
        name: "name",
        type: 3,
        required: true,
        description: "Thread Name",
      },
      { name: "url", type: 3, required: true, description: "Tweet URL" },
    ],
  },
};
