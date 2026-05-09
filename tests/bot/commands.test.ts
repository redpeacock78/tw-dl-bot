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

  await t.step(
    "threadDlCommand: maps to THREAD_DOWNLOAD + only name option (URLs are collected via Modal)",
    () => {
      assertEquals(
        Commands.threadDlCommand.name,
        Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD,
      );
      assertEquals(Commands.threadDlCommand.type, 1);
      // url option intentionally removed in the Modal-based flow
      assertEquals(Commands.threadDlCommand.options?.length, 1);

      const opts = Commands.threadDlCommand.options ?? [];
      const optByName = Object.fromEntries(opts.map((o) => [o.name, o]));

      assertEquals(optByName.name?.required, true);
      assertEquals(optByName.name?.type, 3);
      assertEquals(optByName.name?.description, "Thread Name");

      // url option no longer exists on the slash command — URLs come from
      // the Modal that opens after the user invokes /threaddl
      assertEquals(optByName.url, undefined);
    },
  );

  await t.step(
    "threadDlSpoilerCommand: maps to THREAD_DOWNLOAD_SPOILER + only name option (Modal-based)",
    () => {
      assertEquals(
        Commands.threadDlSpoilerCommand.name,
        Constants.Webhook.Json.ClientPayload.CommandType
          .THREAD_DOWNLOAD_SPOILER,
      );
      assertEquals(Commands.threadDlSpoilerCommand.type, 1);
      assertEquals(
        Commands.threadDlSpoilerCommand.description,
        "DL multiple Tweets into a thread with spoiler",
      );
      assertEquals(Commands.threadDlSpoilerCommand.options?.length, 1);

      const opts = Commands.threadDlSpoilerCommand.options ?? [];
      const optByName = Object.fromEntries(opts.map((o) => [o.name, o]));

      assertEquals(optByName.name?.required, true);
      assertEquals(optByName.name?.type, 3);
      assertEquals(optByName.name?.description, "Thread Name");
      assertEquals(optByName.url, undefined);
    },
  );

  await t.step(
    "threadDl ↔ threadDlSpoiler share the same options shape (parity check)",
    () => {
      const normal = (Commands.threadDlCommand.options ?? [])
        .map((o) => ({ name: o.name, type: o.type, required: o.required }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const spoiler = (Commands.threadDlSpoilerCommand.options ?? [])
        .map((o) => ({ name: o.name, type: o.type, required: o.required }))
        .sort((a, b) => a.name.localeCompare(b.name));
      assertEquals(spoiler, normal);
    },
  );
});
