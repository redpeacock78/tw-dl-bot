import { assertEquals } from "@std/assert";
import { Commands } from "../../src/bot/commands.ts";
import { Constants } from "../../src/libs/constants.ts";

Deno.test("Commands", async (t) => {
  await t.step("dlCommand: name maps to DOWNLOAD constant + required url option", () => {
    assertEquals(
      Commands.dlCommand.name,
      Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD,
    );
    assertEquals(Commands.dlCommand.type, 1);
    assertEquals(Commands.dlCommand.description, "Download tweet video");
    assertEquals(Commands.dlCommand.options?.length, 1);
    const url = Commands.dlCommand.options?.[0];
    assertEquals(url?.name, "url");
    assertEquals(url?.type, 3); // ApplicationCommandOptionTypes.String
    assertEquals(url?.required, true);
    assertEquals(url?.description, "Tweet URL");
  });

  await t.step("dlSpoilerCommand: maps to DOWNLOAD_SPOILER + required url option", () => {
    assertEquals(
      Commands.dlSpoilerCommand.name,
      Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD_SPOILER,
    );
    assertEquals(Commands.dlSpoilerCommand.type, 1);
    assertEquals(
      Commands.dlSpoilerCommand.description,
      "Download tweet video with spoiler",
    );
    assertEquals(Commands.dlSpoilerCommand.options?.length, 1);
    const url = Commands.dlSpoilerCommand.options?.[0];
    assertEquals(url?.name, "url");
    assertEquals(url?.type, 3);
    assertEquals(url?.required, true);
  });

  await t.step("threadDlCommand: maps to THREAD_DOWNLOAD + name + url options", () => {
    assertEquals(
      Commands.threadDlCommand.name,
      Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD,
    );
    assertEquals(Commands.threadDlCommand.type, 1);
    assertEquals(Commands.threadDlCommand.options?.length, 2);

    const opts = Commands.threadDlCommand.options ?? [];
    const optByName = Object.fromEntries(opts.map((o) => [o.name, o]));

    assertEquals(optByName.name?.required, true);
    assertEquals(optByName.name?.type, 3);
    assertEquals(optByName.name?.description, "Thread Name");

    assertEquals(optByName.url?.required, true);
    assertEquals(optByName.url?.type, 3);
    assertEquals(optByName.url?.description, "Tweet URL");
  });
});
