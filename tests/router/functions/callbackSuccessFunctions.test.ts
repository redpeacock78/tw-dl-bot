import { assertEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import type { Message } from "discordeno";
import bot from "../../../src/bot/bot.ts";
import callbackSuccessFunctions from "../../../src/router/functions/callbackSuccessFunctions.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeMsg = {} as unknown as Message;

/** Minimal Hono Context stub — only the `body()` method is needed. */
const makeCtx = () => ({
  body(_data: BodyInit | null, init?: { status: number } | number): Response {
    const status =
      typeof init === "number"
        ? init
        : ((init as { status: number } | undefined)?.status ?? 200);
    return new Response(null, { status });
  },
});

type CommandType = "dl" | "dl-spoiler" | "threaddl" | "threaddl-spoiler";

/** Build a minimal body with file1+name1 for single-file success. */
function makeBody(
  commandType: CommandType = "dl",
  extra: Record<string, unknown> = {},
) {
  return {
    status: "success" as const,
    number: "1",
    commandType,
    startTime: String(Date.now() - 1_000), // 1s ago — well within time limit
    channel: "111222333",
    message: "444555666",
    token: "fake-token",
    link: "https://example.com/status/1",
    type: "video",
    size: "1024",
    oversize: "false" as const,
    file1: new File(["video-data"], "test.mp4", { type: "video/mp4" }),
    name1: "test.mp4",
    ...extra,
  };
}

/** Build a minimal body with file1+name1+file2+name2 for multi-file success. */
function makeMultiBody(
  commandType: CommandType = "dl",
  extra: Record<string, unknown> = {},
) {
  return {
    ...makeBody(commandType, extra),
    file2: new File(["video-data-2"], "test2.mp4", { type: "video/mp4" }),
    name2: "test2.mp4",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("callbackSuccessFunctions — handleSingleSuccess", async (t) => {
  // ── Case 1: dl (useThread=false, short runTime) → editFollowupMessage ──
  await t.step(
    "dl + no shardIndex → editFollowupMessage called, returns 204",
    async () => {
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackSuccessFunctions.success.dl.single({
          c: makeCtx() as never,
          body: makeBody("dl") as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editFollowup, 1);
        assertSpyCalls(editMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 2: threadDl (useThread=true) → fetch called (not editMessage) ──
  await t.step(
    "threadDl + no shardIndex → fetch called (not editMessage), returns 204",
    async () => {
      const fetchStub = stub(
        globalThis,
        "fetch",
        async () => new Response("{}", { status: 200 }),
      );
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackSuccessFunctions.success.threadDl.single({
          c: makeCtx() as never,
          body: makeBody("threaddl") as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
      } finally {
        fetchStub.restore();
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 3: threadDl + shardIndex → runNumber is "#N-XX" in embed ──
  await t.step(
    "threadDl + shardIndex=02 → fetch called with runNumber '1-02' in payload_json embed",
    async () => {
      let capturedInit: RequestInit | undefined;
      const fetchStub = stub(
        globalThis,
        "fetch",
        async (_input: unknown, init?: unknown) => {
          capturedInit = init as RequestInit;
          return new Response("{}", { status: 200 });
        },
      );
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackSuccessFunctions.success.threadDl.single({
          c: makeCtx() as never,
          body: makeBody("threaddl", { shardIndex: "02" }) as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(editMsg, 0);
        // The RUN_NUMBER embed field should contain "1-02" (in payload_json)
        const form = capturedInit!.body as FormData;
        const payloadJson = JSON.parse(form.get("payload_json") as string) as {
          embeds?: { fields?: { value: string }[] }[];
        };
        const embed = payloadJson?.embeds?.[0];
        const runField = embed?.fields?.find((f) => f.value.includes("1-02"));
        assertEquals(runField !== undefined, true);
      } finally {
        fetchStub.restore();
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 4: dl + no shardIndex → runNumber is plain "#N" ──
  await t.step(
    "dl + no shardIndex → editFollowupMessage called with plain runNumber '1'",
    async () => {
      let capturedPayload: unknown;
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        (_tok, _msg, payload) => {
          capturedPayload = payload;
          return Promise.resolve(fakeMsg);
        },
      );
      try {
        const res = await callbackSuccessFunctions.success.dl.single({
          c: makeCtx() as never,
          body: makeBody("dl") as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editFollowup, 1);
        // The RUN_NUMBER embed field value should be `> \`#1\`` with no dash
        const embed = (
          capturedPayload as { embeds?: { fields?: { value: string }[] }[] }
        )?.embeds?.[0];
        const runField = embed?.fields?.find((f) => f.value === "> `#1`");
        assertEquals(runField !== undefined, true);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 5: null body → 500 immediately ──
  await t.step("null body → returns 500 without calling Discord helpers", async () => {
    const editMsg = stub(
      bot.helpers,
      "editMessage",
      () => Promise.resolve(fakeMsg),
    );
    const editFollowup = stub(
      bot.helpers,
      "editFollowupMessage",
      () => Promise.resolve(fakeMsg),
    );
    try {
      const res = await callbackSuccessFunctions.success.dl.single({
        c: makeCtx() as never,
        body: null,
      });
      assertEquals(res.status, 500);
      assertSpyCalls(editMsg, 0);
      assertSpyCalls(editFollowup, 0);
    } finally {
      editMsg.restore();
      editFollowup.restore();
    }
  });

  // ── Case 6: threadDlSpoiler + shardIndex → fetch (spoiler+thread) ──
  await t.step(
    "threadDlSpoiler + shardIndex=03 → fetch called with '1-03' in payload_json embed",
    async () => {
      let capturedInit: RequestInit | undefined;
      const fetchStub = stub(
        globalThis,
        "fetch",
        async (_input: unknown, init?: unknown) => {
          capturedInit = init as RequestInit;
          return new Response("{}", { status: 200 });
        },
      );
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res =
          await callbackSuccessFunctions.success.threadDlSpoiler.single({
            c: makeCtx() as never,
            body: makeBody("threaddl-spoiler", { shardIndex: "03" }) as never,
          });
        assertEquals(res.status, 204);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(editMsg, 0);
        const form = capturedInit!.body as FormData;
        const payloadJson = JSON.parse(form.get("payload_json") as string) as {
          embeds?: { fields?: { value: string }[] }[];
        };
        const embed = payloadJson?.embeds?.[0];
        const runField = embed?.fields?.find((f) => f.value.includes("1-03"));
        assertEquals(runField !== undefined, true);
      } finally {
        fetchStub.restore();
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );
});

Deno.test("callbackSuccessFunctions — handleMultiSuccess", async (t) => {
  // ── Case 7: dl multi (useThread=false) → editFollowupMessage ──
  await t.step(
    "dl.multi + no shardIndex → editFollowupMessage called, returns 204",
    async () => {
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackSuccessFunctions.success.dl.multi({
          c: makeCtx() as never,
          body: makeMultiBody("dl") as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editFollowup, 1);
        assertSpyCalls(editMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 8: threadDl multi + shardIndex → fetch with "#N-XX" ──
  await t.step(
    "threadDl.multi + shardIndex=01 → fetch called with '1-01' in payload_json embed",
    async () => {
      let capturedInit: RequestInit | undefined;
      const fetchStub = stub(
        globalThis,
        "fetch",
        async (_input: unknown, init?: unknown) => {
          capturedInit = init as RequestInit;
          return new Response("{}", { status: 200 });
        },
      );
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackSuccessFunctions.success.threadDl.multi({
          c: makeCtx() as never,
          body: makeMultiBody("threaddl", { shardIndex: "01" }) as never,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(fetchStub, 1);
        assertSpyCalls(editMsg, 0);
        const form = capturedInit!.body as FormData;
        const payloadJson = JSON.parse(form.get("payload_json") as string) as {
          embeds?: { fields?: { value: string }[] }[];
        };
        const embed = payloadJson?.embeds?.[0];
        const runField = embed?.fields?.find((f) => f.value.includes("1-01"));
        assertEquals(runField !== undefined, true);
      } finally {
        fetchStub.restore();
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );
});
