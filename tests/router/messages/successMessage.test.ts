import { assertEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import type { Message } from "discordeno";
import bot from "../../../src/bot/bot.ts";
import successMessage from "../../../src/router/messages/successMessage.ts";
import { Constants } from "../../../src/libs/constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIMIT = Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT; // 900_000 ms
const fakeMsg = {} as unknown as Message;

/** Build a singleFile input. startTime controls the computed runTime. */
const makeSingleObj = (
  useThread: boolean,
  oversize: "true" | "false",
  startTime?: string,
) => ({
  token: "fake-token",
  channelId: "111",
  messageId: "222",
  runNumber: "5",
  startTime: startTime ?? String(Date.now() - 1_000), // 1 s ago (short)
  totalSize: "1024000",
  fileName: "video.mp4",
  link: "https://example.com",
  file: new Blob(["x"]),
  oversize,
  spoiler: false,
  useThread,
});

/** Build a multiFiles input. */
const makeMultiObj = (
  useThread: boolean,
  oversize: "true" | "false",
  startTime?: string,
) => ({
  token: "fake-token",
  channelId: "111",
  messageId: "222",
  runNumber: "5",
  startTime: startTime ?? String(Date.now() - 1_000),
  totalSize: "2048000",
  fileNamesArray: ["clip1.mp4", "clip2.mp4"],
  link: "https://example.com",
  filesArray: [
    { blob: new Blob(["x"]), name: "clip1.mp4" },
    { blob: new Blob(["y"]), name: "clip2.mp4" },
  ] as never,
  oversize,
  spoiler: false,
  useThread,
});

// ---------------------------------------------------------------------------
// successMessage.singleFile
// ---------------------------------------------------------------------------

Deno.test("successMessage.singleFile", async (t) => {
  // ── Case 1: useThread=true → editMessage (short-circuits all other gates) ──
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
        await successMessage.singleFile(
          makeSingleObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
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
        await successMessage.singleFile(makeSingleObj(false, "false"));
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

  // ── Case 3: useThread=false, runTime > LIMIT, oversize=false → editFollowupMessage
  //    (oversize !== "true" short-circuits even when time gate fails) ──
  await t.step(
    "useThread=false, runTime > 15 min, oversize=false → editFollowupMessage (oversize gate)",
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
        await successMessage.singleFile(
          makeSingleObj(false, "false", String(Date.now() - (LIMIT + 60_000))),
        );
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

  // ── Case 4: useThread=false, runTime > LIMIT, oversize=true → sendMessage ──
  await t.step(
    "useThread=false, runTime > 15 min, oversize=true → sendMessage (all gates fail)",
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
        await successMessage.singleFile(
          makeSingleObj(false, "true", String(Date.now() - (LIMIT + 60_000))),
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
});

// ---------------------------------------------------------------------------
// successMessage.multiFiles
// ---------------------------------------------------------------------------

Deno.test("successMessage.multiFiles", async (t) => {
  // ── Case 5: useThread=true → editMessage ──
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
        await successMessage.multiFiles(
          makeMultiObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
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

  // ── Case 6: useThread=false, short runTime → editFollowupMessage ──
  await t.step(
    "useThread=false, short runTime → editFollowupMessage",
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
        await successMessage.multiFiles(makeMultiObj(false, "false"));
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

  // ── Case 7: useThread=false, runTime > LIMIT, oversize=true → sendMessage ──
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
        await successMessage.multiFiles(
          makeMultiObj(false, "true", String(Date.now() - (LIMIT + 60_000))),
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

  // ── Case 8: useThread=true, runTime > LIMIT, oversize=true → editMessage ──
  await t.step(
    "useThread=true, runTime > 15 min, oversize=true → editMessage (useThread wins all)",
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
        await successMessage.multiFiles(
          makeMultiObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
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

// ---------------------------------------------------------------------------
// assertEquals sanity: EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT is 900_000 ms
// ---------------------------------------------------------------------------
Deno.test("Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT equals 900000", () => {
  assertEquals(Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT, 900_000);
});
