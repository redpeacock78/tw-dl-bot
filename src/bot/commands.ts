import { CreateSlashApplicationCommand } from "discordeno";

type CommandsType = {
  dlCommand: CreateSlashApplicationCommand;
};

export const Commands: CommandsType = {
  dlCommand: {
    name: "dl",
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
};
