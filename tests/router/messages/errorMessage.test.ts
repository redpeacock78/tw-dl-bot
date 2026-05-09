import { assertSpyCalls, stub } from "@std/testing/mock";
import type { Message } from "discordeno";
import bot from "../../../src/bot/bot.ts";
import errorMessage from "../../../src/router/messages/errorMessage.ts";
import { Constants } from "../../../src/libs/constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIMIT = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT; // 900_000 ms
const fakeMsg = {} as unknown as Message;

const makeObj = (
  useThread: boolean,
  oversize: "true" | "false",
  startTime?: string,
) => ({
  token: "fake-token",
  channel: "111222333",
  message: "444555666",
  number: "3",
  link: "https://example.com",
  description: "something went wrong",
  startTime: startTime ?? String(Date.now() - 1_000),
  oversize,
  useThread,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("errorMessage", async (t) => {
  // ── Case 1: useThread=true → editMessage ──
  await t.step(
    "useThread=true → calls editMessage regardless of runtime/oversize",
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
        await errorMessage(
          makeObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
        );
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

  // ── Case 2: useThread=false, short runTime, oversize=false → editFollowupMessage ──
  await t.step(
    "useThread=false, short runTime, oversize=false → editFollowupMessage",
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
        await errorMessage(makeObj(false, "false"));
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

  // ── Case 3: useThread=false, runTime > LIMIT, oversize=true → sendMessage ──
  await t.step(
    "useThread=false, runTime > 15 min, oversize=true → sendMessage",
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
        await errorMessage(
          makeObj(false, "true", String(Date.now() - (LIMIT + 60_000))),
        );
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

  // ── Case 4: useThread=true, runTime > LIMIT, oversize=true → editMessage (useThread wins) ──
  await t.step(
    "useThread=true, runTime > 15 min, oversize=true → editMessage (useThread wins all gates)",
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
        await errorMessage(
          makeObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
        );
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
});
