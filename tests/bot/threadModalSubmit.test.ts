import { assertEquals } from "@std/assert";
import { assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Spy } from "@std/testing/mock";
import type { Bot, Interaction, Message } from "discordeno";
import { threadModalSubmit } from "../../src/bot/threadModalSubmit.ts";

// deno-lint-ignore no-explicit-any
type AnySpy = Spy<unknown, any[], any>;

type FakeBot = {
  helpers: {
    sendInteractionResponse: AnySpy;
    sendFollowupMessage: AnySpy;
    startThreadWithoutMessage: AnySpy;
    sendMessage: AnySpy;
    editMessage: AnySpy;
  };
};

/**
 * Bot fake that lets `runThreadFlow` walk through the happy path:
 * - sendInteractionResponse / sendFollowupMessage just resolve
 * - startThreadWithoutMessage returns a fake thread with id=42n
 * - sendMessage returns Messages with sequential ids so the eventual
 *   `webhookThread` payload has unique `message` strings per URL
 */
const makeFakeBot = (): FakeBot => {
  let nextMsgId = 1n;
  return {
    helpers: {
      sendInteractionResponse: spy(() => Promise.resolve(undefined)),
      sendFollowupMessage: spy((_t: string, _p: unknown) =>
        Promise.resolve({ id: 999n, channelId: 111n } as unknown as Message)
      ),
      startThreadWithoutMessage: spy((_chan: bigint, _opts: unknown) =>
        Promise.resolve({ id: 42n } as { id: bigint })
      ),
      sendMessage: spy((_chan: bigint, _payload: unknown) => {
        const id = nextMsgId++;
        return Promise.resolve({ id, channelId: 42n } as unknown as Message);
      }),
      editMessage: spy(() =>
        Promise.resolve({} as unknown as Message)
      ),
    },
  };
};

const makeModalSubmitInteraction = (
  customId: string,
  urlsValue: string,
  opts: { channelId?: bigint; guildId?: bigint | undefined } = {},
): Interaction => {
  // Note: explicit `in` check so callers can pass `guildId: undefined`
  // (DM context) and have it actually be undefined, rather than
  // `?? 500n` silently substituting a default.
  const channelId = "channelId" in opts ? opts.channelId : 100n;
  const guildId = "guildId" in opts ? opts.guildId : 500n;
  return {
    id: 200n,
    token: "fake-modal-token",
    type: 5, // InteractionTypes.ModalSubmit
    channelId,
    guildId,
    data: {
      customId,
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 4, // InputText
              customId: "urls",
              value: urlsValue,
            },
          ],
        },
      ],
    },
  } as unknown as Interaction;
};

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

Deno.test("threadModalSubmit", async (t) => {
  await t.step(
    "valid /threaddl submit with newline-separated URLs: creates a thread + N queue messages + 1 webhook",
    async () => {
      const bot = makeFakeBot();
      const text =
        "https://twitter.com/u/status/1\nhttps://twitter.com/u/status/2\nhttps://twitter.com/u/status/3";
      const interaction = makeModalSubmitInteraction("threaddl|My Thread", text);
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        // 1 Defer ACK + 1 "thread created" followup
        assertSpyCalls(bot.helpers.sendInteractionResponse, 1);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1);

        // Thread creation w/ the parsed thread name
        assertSpyCalls(bot.helpers.startThreadWithoutMessage, 1);
        const startArgs = bot.helpers.startThreadWithoutMessage.calls[0].args;
        assertEquals(startArgs[0], 100n); // channelId
        assertEquals(
          (startArgs[1] as { name: string }).name,
          "My Thread",
        );

        // 3 queue messages, one per URL
        assertSpyCalls(bot.helpers.sendMessage, 3);

        // exactly 1 repository_dispatch fan-out
        assertSpyCalls(fetchStub, 1);
        const fetchArg0 = fetchStub.calls[0].args[0];
        const req =
          fetchArg0 instanceof Request
            ? fetchArg0
            : new Request(fetchArg0 as string, fetchStub.calls[0]
                .args[1] as RequestInit | undefined);
        const body = JSON.parse(await req.text()) as {
          event_type: string;
          client_payload: {
            commandType: string;
            channel: string;
            links: Array<{ link: string; message: string }>;
          };
        };
        assertEquals(body.event_type, "thread-download");
        assertEquals(body.client_payload.commandType, "threaddl");
        assertEquals(body.client_payload.channel, "42");
        assertEquals(body.client_payload.links.length, 3);
        assertEquals(
          body.client_payload.links.map((l) => l.link),
          [
            "https://twitter.com/u/status/1",
            "https://twitter.com/u/status/2",
            "https://twitter.com/u/status/3",
          ],
        );
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "/threaddl-spoiler submit: forwards spoiler commandType into the dispatch payload",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeModalSubmitInteraction(
        "threaddl-spoiler|Hidden",
        "https://twitter.com/u/status/1",
      );
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        assertSpyCalls(fetchStub, 1);
        const fetchArg0 = fetchStub.calls[0].args[0];
        const req =
          fetchArg0 instanceof Request
            ? fetchArg0
            : new Request(fetchArg0 as string, fetchStub.calls[0]
                .args[1] as RequestInit | undefined);
        const body = JSON.parse(await req.text()) as {
          client_payload: { commandType: string };
        };
        assertEquals(body.client_payload.commandType, "threaddl-spoiler");
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "delimiter-agnostic URL extraction: spaces, commas, newlines, mixed",
    async () => {
      const bot = makeFakeBot();
      const text =
        "https://twitter.com/u/status/1, https://twitter.com/u/status/2\n  https://twitter.com/u/status/3 https://twitter.com/u/status/4";
      const interaction = makeModalSubmitInteraction("threaddl|t", text);
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        // 4 queue messages → 4 URLs were extracted
        assertSpyCalls(bot.helpers.sendMessage, 4);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "no URLs in submitted text: posts an error followup, never creates a thread",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeModalSubmitInteraction(
        "threaddl|t",
        "no urls here at all",
      );
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 1); // Defer ACK
        assertSpyCalls(bot.helpers.sendFollowupMessage, 1); // error embed
        assertSpyCalls(bot.helpers.startThreadWithoutMessage, 0);
        assertSpyCalls(bot.helpers.sendMessage, 0);
        assertSpyCalls(fetchStub, 0);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "DM context (guildId missing): rejects before creating a thread",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeModalSubmitInteraction(
        "threaddl|t",
        "https://twitter.com/u/status/1",
        { guildId: undefined },
      );
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        assertSpyCalls(bot.helpers.startThreadWithoutMessage, 0);
        assertSpyCalls(fetchStub, 0);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "unknown customId prefix: silently dropped (no Defer, no fetch, no thread)",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeModalSubmitInteraction(
        "evilbot|payload",
        "https://twitter.com/u/status/1",
      );
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 0);
        assertSpyCalls(bot.helpers.sendFollowupMessage, 0);
        assertSpyCalls(bot.helpers.startThreadWithoutMessage, 0);
        assertSpyCalls(fetchStub, 0);
      } finally {
        fetchStub.restore();
      }
    },
  );

  await t.step(
    "customId without separator: silently dropped",
    async () => {
      const bot = makeFakeBot();
      const interaction = makeModalSubmitInteraction(
        "threaddl",
        "https://twitter.com/u/status/1",
      );
      const fetchStub = stubFetchOk();

      try {
        await threadModalSubmit({
          b: bot as unknown as Bot,
          data: interaction.data!,
          interaction,
        });

        assertSpyCalls(bot.helpers.sendInteractionResponse, 0);
        assertSpyCalls(fetchStub, 0);
      } finally {
        fetchStub.restore();
      }
    },
  );
});
