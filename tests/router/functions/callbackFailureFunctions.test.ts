import { assertEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import type { Message } from "discordeno";
import bot from "../../../src/bot/bot.ts";
import callbackFailureFunctions from "../../../src/router/functions/callbackFailureFunctions.ts";
import { Constants } from "../../../src/libs/constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIMIT = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT; // 900_000 ms
const fakeMsg = {} as unknown as Message;

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

const makeBody = (
  commandType: CommandType = "dl",
  startTime?: string,
) => ({
  status: "failure" as const,
  number: "2",
  commandType,
  startTime: startTime ?? String(Date.now() - 1_000),
  channel: "111222333",
  message: "444555666",
  token: "fake-token",
  link: "https://example.com/status/2",
  content: "download failed",
  type: "failure",
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("callbackFailureFunctions.failure", async (t) => {
  // ── Case 1: useThread=true, short runTime → editMessage ──
  await t.step(
    "useThread=true (threaddl), short runTime → calls editMessage, returns 204",
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody("threaddl"),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 2: useThread=true, runTime > LIMIT → editMessage (load-bearing!) ──
  await t.step(
    "useThread=true (threaddl), runTime > 15 min → editMessage bypasses time gate",
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody("threaddl", String(Date.now() - (LIMIT + 60_000))),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 3: useThread=true (spoiler), runTime > LIMIT → editMessage ──
  await t.step(
    "useThread=true (threaddl-spoiler), runTime > 15 min → editMessage, not sendMessage",
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody(
            "threaddl-spoiler",
            String(Date.now() - (LIMIT + 60_000)),
          ),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 4: useThread=false, short runTime → editFollowupMessage ──
  await t.step(
    "useThread=false (dl), short runTime → calls editFollowupMessage, returns 204",
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody("dl"),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editFollowup, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 5: useThread=false, runTime > LIMIT → sendMessage (not silent drop!) ──
  await t.step(
    "useThread=false (dl), runTime > 15 min → falls back to sendMessage, returns 204",
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody("dl", String(Date.now() - (LIMIT + 60_000))),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(sendMsg, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 6 (shardIndex): threaddl + shardIndex → run number is "#N-XX" ──
  await t.step(
    "threaddl + shardIndex=03 → editMessage called with runNumber '2-03'",
    async () => {
      let capturedArg: unknown;
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        (_ch: unknown, _msg: unknown, payload: unknown) => {
          capturedArg = payload;
          return Promise.resolve(fakeMsg);
        },
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const body = { ...makeBody("threaddl"), shardIndex: "03" };
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body,
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
        const embed = (capturedArg as { embeds?: { fields?: { value: string }[] }[] })
          ?.embeds?.[0];
        const runField = embed?.fields?.find((f) => f.value.includes("2-03"));
        assertEquals(runField !== undefined, true);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 7: editMessage rejects → 500 ──
  await t.step(
    "editMessage rejects → returns 500",
    async () => {
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.reject(new Error("Discord error")),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.resolve(fakeMsg),
      );
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        const res = await callbackFailureFunctions.failure({
          c: makeCtx() as never,
          body: makeBody("threaddl"),
        });
        assertEquals(res.status, 500);
      } finally {
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );
});
