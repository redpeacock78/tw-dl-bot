import { assertEquals, assertStringIncludes } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";
import type { Spy } from "@std/testing/mock";
import type { Bot, Interaction } from "discordeno";
import {
  InteractionResponseTypes,
  MessageComponentTypes,
  TextStyles,
} from "discordeno";
import { Constants } from "@libs";
import { threadInteractionCreate } from "@bot/threadInteractionCreate.ts";

// deno-lint-ignore no-explicit-any
type AnySpy = Spy<unknown, any[], any>;
type FakeBot = { helpers: { sendInteractionResponse: AnySpy } };

const makeFakeBot = (): FakeBot => ({
  helpers: {
    sendInteractionResponse: spy(() => Promise.resolve(undefined)),
  },
});

const makeAppCommandInteraction = (name: string, threadName: string) =>
  ({
    id: 100n,
    token: "fake-interaction-token",
    data: {
      name,
      options: [{ name: "name", value: threadName, type: 3 }],
    },
  }) as unknown as Interaction;

Deno.test("threadInteractionCreate (Modal opener)", async (t) => {
  await t.step(
    "/threaddl: responds with a Modal whose customId encodes commandType + threadName",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeAppCommandInteraction("threaddl", "My Thread");

      await threadInteractionCreate({
        b: bot as unknown as Bot,
        data: interaction.data!,
        interaction,
        commandType: "threaddl",
      });

      assertSpyCalls(bot.helpers.sendInteractionResponse, 1);

      const args = bot.helpers.sendInteractionResponse.calls[0].args;
      assertEquals(args[0], 100n);
      assertEquals(args[1], "fake-interaction-token");

      const payload = args[2] as {
        type: number;
        data: {
          title: string;
          customId: string;
          components: Array<{
            type: number;
            components: Array<{
              type: number;
              customId: string;
              style: number;
              label: string;
              required: boolean;
              minLength: number;
              maxLength: number;
            }>;
          }>;
        };
      };
      assertEquals(payload.type, InteractionResponseTypes.Modal);
      assertEquals(payload.data.customId, "threaddl|My Thread");
      assertStringIncludes(payload.data.title, "My Thread");

      assertEquals(payload.data.components.length, 1);
      const row = payload.data.components[0];
      assertEquals(row.type, MessageComponentTypes.ActionRow);
      assertEquals(row.components.length, 1);

      const input = row.components[0];
      assertEquals(input.type, MessageComponentTypes.InputText);
      assertEquals(input.customId, Constants.Modal.URLS_INPUT_CUSTOM_ID);
      assertEquals(input.style, TextStyles.Paragraph);
      assertEquals(input.required, true);
      assertEquals(input.minLength, 1);
      assertEquals(input.maxLength, 4000);
    },
  );

  await t.step(
    "/threaddl-spoiler: customId carries the spoiler commandType prefix",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeAppCommandInteraction(
        "threaddl-spoiler",
        "Hidden",
      );

      await threadInteractionCreate({
        b: bot as unknown as Bot,
        data: interaction.data!,
        interaction,
        commandType: "threaddl-spoiler",
      });

      const args = bot.helpers.sendInteractionResponse.calls[0].args;
      const payload = args[2] as { data: { customId: string } };
      assertEquals(payload.data.customId, "threaddl-spoiler|Hidden");
    },
  );

  await t.step(
    "long thread name is truncated to fit within the 100-char customId limit",
    async () => {
      const bot = makeFakeBot();
      const longName = "A".repeat(200);
      const interaction = makeAppCommandInteraction("threaddl", longName);

      await threadInteractionCreate({
        b: bot as unknown as Bot,
        data: interaction.data!,
        interaction,
        commandType: "threaddl",
      });

      const args = bot.helpers.sendInteractionResponse.calls[0].args;
      const payload = args[2] as { data: { customId: string } };
      assertEquals(payload.data.customId.length <= 100, true);
      // commandType prefix + separator + truncated name
      assertEquals(
        payload.data.customId,
        `threaddl|${"A".repeat(Constants.Modal.MAX_NAME_IN_CUSTOM_ID)}`,
      );
    },
  );

  await t.step(
    "missing name option: still returns a Modal (with empty name in customId)",
    async () => {
      const bot = makeFakeBot();
      const interaction = {
        id: 1n,
        token: "tok",
        data: { name: "threaddl", options: [] },
      } as unknown as Interaction;

      await threadInteractionCreate({
        b: bot as unknown as Bot,
        data: interaction.data!,
        interaction,
        commandType: "threaddl",
      });

      assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
      const args = bot.helpers.sendInteractionResponse.calls[0].args;
      const payload = args[2] as { type: number; data: { customId: string } };
      assertEquals(payload.type, InteractionResponseTypes.Modal);
      assertEquals(payload.data.customId, "threaddl|");
    },
  );
});
