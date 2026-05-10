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
  // ── Case 1: useThread=true → bot.rest.runMethod (not editMessage) ──
  await t.step(
    "useThread=true → calls bot.rest.runMethod regardless of runtime/oversize",
    async () => {
      const runMethod = stub(
        bot.rest,
        "runMethod",
        () => Promise.resolve({}),
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        await successMessage.singleFile(
          makeSingleObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
        );
        assertSpyCalls(runMethod, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        runMethod.restore();
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 1b: useThread=true → payload_json contains attachments ──
  await t.step(
    "useThread=true → runMethod body includes attachments: [{id:0, filename}]",
    async () => {
      let capturedBody: unknown;
      const runMethod = stub(
        bot.rest,
        "runMethod",
        (_rest: unknown, _method: unknown, _route: unknown, body: unknown) => {
          capturedBody = body;
          return Promise.resolve({});
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        await successMessage.singleFile(makeSingleObj(true, "false"));
        assertSpyCalls(runMethod, 1);
        const body = capturedBody as {
          attachments?: { id: number; filename: string }[];
        };
        assertEquals(Array.isArray(body.attachments), true);
        assertEquals(body.attachments?.[0]?.id, 0);
        assertEquals(body.attachments?.[0]?.filename, "video.mp4");
      } finally {
        runMethod.restore();
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
  // ── Case 5: useThread=true → bot.rest.runMethod (not editMessage) ──
  await t.step(
    "useThread=true → calls bot.rest.runMethod regardless of runtime/oversize",
    async () => {
      const runMethod = stub(
        bot.rest,
        "runMethod",
        () => Promise.resolve({}),
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        await successMessage.multiFiles(
          makeMultiObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
        );
        assertSpyCalls(runMethod, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        runMethod.restore();
        editMsg.restore();
        editFollowup.restore();
        sendMsg.restore();
      }
    },
  );

  // ── Case 5b: useThread=true, multi-file → attachments has 2 entries ──
  await t.step(
    "useThread=true, multi-file → attachments: [{id:0},{id:1}] with correct filenames",
    async () => {
      let capturedBody: unknown;
      const runMethod = stub(
        bot.rest,
        "runMethod",
        (_rest: unknown, _method: unknown, _route: unknown, body: unknown) => {
          capturedBody = body;
          return Promise.resolve({});
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        await successMessage.multiFiles(makeMultiObj(true, "false"));
        assertSpyCalls(runMethod, 1);
        const body = capturedBody as {
          attachments?: { id: number; filename: string }[];
        };
        assertEquals(Array.isArray(body.attachments), true);
        assertEquals(body.attachments?.length, 2);
        assertEquals(body.attachments?.[0], { id: 0, filename: "clip1.mp4" });
        assertEquals(body.attachments?.[1], { id: 1, filename: "clip2.mp4" });
      } finally {
        runMethod.restore();
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

  // ── Case 8: useThread=true, runTime > LIMIT, oversize=true → runMethod ──
  await t.step(
    "useThread=true, runTime > 15 min, oversize=true → bot.rest.runMethod (useThread wins all)",
    async () => {
      const runMethod = stub(
        bot.rest,
        "runMethod",
        () => Promise.resolve({}),
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
      const sendMsg = stub(
        bot.helpers,
        "sendMessage",
        () => Promise.resolve(fakeMsg),
      );
      try {
        await successMessage.multiFiles(
          makeMultiObj(true, "true", String(Date.now() - (LIMIT + 60_000))),
        );
        assertSpyCalls(runMethod, 1);
        assertSpyCalls(editMsg, 0);
        assertSpyCalls(editFollowup, 0);
        assertSpyCalls(sendMsg, 0);
      } finally {
        runMethod.restore();
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
