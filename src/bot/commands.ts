import { CreateSlashApplicationCommand } from "discordeno";

export const Commands = {
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
  } as CreateSlashApplicationCommand,
};
