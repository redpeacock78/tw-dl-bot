import { assertStringIncludes } from "@std/assert";
import { assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Bot, Interaction } from "discordeno";
import { InteractionTypes } from "discordeno";
import { Commands } from "@bot/commands.ts";
import bot from "@bot/bot.ts";

Deno.test("bot interaction boundary", async () => {
  const error = new Error(
    "Something went wrong in sendRequest\n" +
      "TypeError: error sending request for url " +
      "(https://discord.com/api/v10//interactions/100/secret-token/callback)",
  );
  const sendInteractionResponse = spy(() => Promise.reject(error));
  const consoleError = stub(console, "error");
  const interaction = {
    id: 100n,
    token: "secret-token",
    type: InteractionTypes.ApplicationCommand,
    data: {
      name: Commands.dlCommand.name,
      options: [
        { name: "url", value: "https://twitter.com/u/status/1", type: 3 },
      ],
    },
  } as unknown as Interaction;

  try {
    await bot.events.interactionCreate(
      {
        helpers: { sendInteractionResponse },
      } as unknown as Bot,
      interaction,
    );

    assertSpyCalls(sendInteractionResponse, 1);
    assertSpyCalls(consoleError, 1);
    const message = String(consoleError.calls[0].args[0]);
    assertStringIncludes(message, "Discord interaction 100 failed");
    assertStringIncludes(message, "<redacted>");
    if (message.includes("secret-token")) {
      throw new Error("interaction token leaked to the error log");
    }
  } finally {
    consoleError.restore();
  }
});
