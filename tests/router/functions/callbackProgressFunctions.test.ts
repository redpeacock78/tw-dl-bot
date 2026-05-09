import { assertEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import type { Message } from "discordeno";
import bot from "../../../src/bot/bot.ts";
import callbackProgressFunctions from "../../../src/router/functions/callbackProgressFunctions.ts";
import { Constants } from "../../../src/libs/constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIMIT = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT; // 900_000 ms
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

const makeBody = (
  commandType: CommandType = "dl",
  startTime?: string,
) => ({
  status: "progress" as const,
  number: "1",
  commandType,
  startTime: startTime ?? String(Date.now() - 1_000), // 1 s ago (short)
  channel: "111222333",
  message: "444555666",
  token: "fake-token",
  link: "https://example.com/status/1",
  content: "50% done",
  type: "progress",
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("callbackProgressFunctions.progress", async (t) => {
  // ── Case 1: useThread=true, short runTime → editMessage (not followup) ──
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
      try {
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("threaddl"),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 2: useThread=true, runTime > LIMIT → still editMessage (load-bearing!) ──
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
      try {
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("threaddl", String(Date.now() - (LIMIT + 60_000))),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 3: useThread=true (spoiler variant), runTime > LIMIT → editMessage ──
  await t.step(
    "useThread=true (threaddl-spoiler), runTime > 15 min → editMessage bypasses time gate",
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
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody(
            "threaddl-spoiler",
            String(Date.now() - (LIMIT + 60_000)),
          ),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 1);
        assertSpyCalls(editFollowup, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
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
      try {
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("dl"),
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

  // ── Case 5: useThread=false, runTime > LIMIT → silent drop (204, no Discord call) ──
  await t.step(
    "useThread=false (dl), runTime > 15 min → silent drop, no Discord call, 204",
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
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("dl", String(Date.now() - (LIMIT + 60_000))),
        });
        assertEquals(res.status, 204);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 6: editMessage rejects → 500 ──
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
      try {
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("threaddl"),
        });
        assertEquals(res.status, 500);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );

  // ── Case 7: editFollowupMessage rejects → 500 ──
  await t.step(
    "editFollowupMessage rejects → returns 500",
    async () => {
      const editMsg = stub(
        bot.helpers,
        "editMessage",
        () => Promise.resolve(fakeMsg),
      );
      const editFollowup = stub(
        bot.helpers,
        "editFollowupMessage",
        () => Promise.reject(new Error("timeout")),
      );
      try {
        const res = await callbackProgressFunctions.progress({
          c: makeCtx() as never,
          body: makeBody("dl"),
        });
        assertEquals(res.status, 500);
      } finally {
        editMsg.restore();
        editFollowup.restore();
      }
    },
  );
});
