import { assertEquals, assertStringIncludes } from "@std/assert";
import { assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Spy } from "@std/testing/mock";
import type { Bot, Interaction, Message } from "discordeno";
import { InteractionResponseTypes } from "discordeno";
import { interactionCreate } from "../../src/bot/interactionCreate.ts";
import { Constants } from "../../src/libs/constants.ts";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type AnySpy = Spy<unknown, any[], any>;
type FakeBot = {
  helpers: {
    sendInteractionResponse: AnySpy;
    sendFollowupMessage: AnySpy;
    editFollowupMessage: AnySpy;
  };
};

/**
 * Sequential id factory so each `sendFollowupMessage` returns a Message
 * with a different `id`. Lets us assert that `editFollowupMessage` is
 * called against the right followup.
 */
const makeFakeBot = (): FakeBot => {
  let nextId = 1n;
  return {
    helpers: {
      sendInteractionResponse: spy(() => Promise.resolve(undefined)),
      sendFollowupMessage: spy((_token: string, _payload: unknown) => {
        const id = nextId++;
        return Promise.resolve({
          id,
          channelId: 9000n + id,
        } as unknown as Message);
      }),
      editFollowupMessage: spy(
        (_token: string, _id: bigint, _payload: unknown) =>
          Promise.resolve({} as unknown as Message),
      ),
    },
  };
};

const makeInteraction = (rawValue: string): Interaction =>
  ({
    id: 100n,
    token: "fake-interaction-token",
    data: {
      name: "dl",
      options: [{ name: "url", value: rawValue, type: 3 }],
    },
  }) as unknown as Interaction;

const stubFetchOk = () =>
  stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
  );

const stubFetchFail = () =>
  // 400 — not in ky's default retry list, so this fails immediately
  // (instead of retrying with backoff and slowing the test down)
  stub(
    globalThis,
    "fetch",
    () =>
      Promise.resolve(
        new Response("nope", {
          status: 400,
          headers: { "content-type": "text/plain" },
        }),
      ),
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("interactionCreate", async (t) => {
  await t.step(
    "single valid URL: defers, posts a Queuing followup, calls webhook once",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction("https://twitter.com/user/status/1");
      const fetchStub = stubFetchOk();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl",
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(bot.helpers.editFollowupMessage, 0);

        // deferred response shape
        const deferArgs = bot.helpers.sendInteractionResponse.calls[0].args;
        assertEquals(deferArgs[0], 100n);
        assertEquals(deferArgs[1], "fake-interaction-token");
        assertEquals(
          (deferArgs[2] as { type: number }).type,
          InteractionResponseTypes.DeferredChannelMessageWithSource,
        );

        // followup carries the queuing progress message
        const followupArgs = bot.helpers.sendFollowupMessage.calls[0].args;
        assertEquals(followupArgs[0], "fake-interaction-token");
        const followupPayload = followupArgs[1] as {
          type: number;
          data: { content: string };
        };
        assertEquals(
          followupPayload.type,
          InteractionResponseTypes.ChannelMessageWithSource,
        );
        // createProgressMessage rewrites `...` → `...<loading_spinner_emoji>`
        // and wraps in extra `**`, so just sanity-check the substring.
        assertStringIncludes(followupPayload.data.content, "Queuing");

        // webhook was POSTed to the configured DISPATCH_URL
        const fetchArg0 = fetchStub.calls[0].args[0];
        const url =
          fetchArg0 instanceof URL || typeof fetchArg0 === "string"
            ? fetchArg0.toString()
            : (fetchArg0 as Request).url;
        assertEquals(url.startsWith("https://example.invalid/dispatch"), true);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "multiple space-separated valid URLs: one webhook per URL, in parallel",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction(
        "https://twitter.com/u/status/1 https://twitter.com/u/status/2 https://twitter.com/u/status/3",
      );
      const fetchStub = stubFetchOk();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl",
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 3);
        assertSpyCalls(fetchStub, 3);
        assertSpyCalls(bot.helpers.editFollowupMessage, 0);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "single invalid URL: defers, posts ERROR embed, never calls webhook",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction("not-a-url");
      const fetchStub = stubFetchOk();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl",
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1);
        assertSpyCalls(fetchStub, 0);
        assertSpyCalls(bot.helpers.editFollowupMessage, 0);

        const followupPayload = bot.helpers.sendFollowupMessage.calls[0]
          .args[1] as {
          data: { content: string };
        };
        assertEquals(
          followupPayload.data.content,
          Constants.Message.Content.Status.ERROR,
        );
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "mixed valid + invalid input takes the error path (every() short-circuits)",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction(
        "https://twitter.com/u/status/1 not-a-url",
      );
      const fetchStub = stubFetchOk();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl",
        });

        // single error followup, no webhook calls
        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1);
        assertSpyCalls(fetchStub, 0);
        assertSpyCalls(bot.helpers.editFollowupMessage, 0);

        const payload = bot.helpers.sendFollowupMessage.calls[0].args[1] as {
          data: { content: string; embeds: Array<{ description: string }> };
        };
        assertEquals(
          payload.data.content,
          Constants.Message.Content.Status.ERROR,
        );
        assertEquals(
          payload.data.embeds[0].description,
          "**https://twitter.com/u/status/1\nnot-a-url**",
        );
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "webhook failure: progress followup posted then editFollowupMessage with ERROR embed",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction("https://twitter.com/user/status/9");
      const fetchStub = stubFetchFail();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl-spoiler",
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(bot.helpers.editFollowupMessage, 1);

        const editArgs = bot.helpers.editFollowupMessage.calls[0].args;
        assertEquals(editArgs[0], "fake-interaction-token");
        // edit targets the followup's id, which the fake assigns as 1n
        assertEquals(editArgs[1], 1n);
        const editPayload = editArgs[2] as {
          content: string;
          embeds: Array<{ fields: Array<{ value: string }> }>;
        };
        assertEquals(
          editPayload.content,
          Constants.Message.Content.Status.ERROR,
        );
        // SOURCE_URL field carries the original URL
        const sourceField = editPayload.embeds[0].fields.find((f) =>
          f.value.includes("https://twitter.com/user/status/9"),
        );
        assertEquals(typeof sourceField?.value, "string");
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "commandType is forwarded to the webhook payload",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeInteraction("https://twitter.com/u/status/1");
      const fetchStub = stubFetchOk();

      try {
        await interactionCreate({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
          commandType: "dl-spoiler",
        });

        assertSpyCalls(fetchStub, 1);
        // ky passes a Request object as the first argument to fetch.
        const fetchArg0 = fetchStub.calls[0].args[0];
        const req =
          fetchArg0 instanceof Request
            ? fetchArg0
            : new Request(fetchArg0 as string, fetchStub.calls[0]
                .args[1] as RequestInit | undefined);
        const bodyText = await req.text();
        const body = JSON.parse(bodyText) as {
          client_payload: { commandType: string; link: string };
        };
        assertEquals(body.client_payload.commandType, "dl-spoiler");
        assertEquals(
          body.client_payload.link,
          "https://twitter.com/u/status/1",
        );
      } finally {
        fetchStub.restore();
      }
    },
  );
});
