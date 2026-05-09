/**
 * Tests for the POST /callback Hono route.
 *
 * Strategy: stub every Functions.* handler to return a 204 Response so we can
 * isolate routing logic (which pattern triggers which handler) without making
 * real Discord API calls.
 */
import { assertEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import { Functions } from "../../src/router/functions/index.ts";
import callback from "../../src/router/callback.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok204 = (): Promise<Response> =>
  Promise.resolve(new Response(null, { status: 204 }));

/** POST a JSON body to the /callback Hono app and return the Response. */
const post = async (body: Record<string, unknown>): Promise<Response> => {
  const result = callback.request("/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return result instanceof Promise ? await result : result;
};

/** A minimal body scaffold — add/override fields per test. */
const base = () => ({
  number: "1",
  startTime: String(Date.now() - 1_000),
  channel: "111",
  message: "222",
  token: "tok",
  link: "https://example.com",
  type: "progress",
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("callback POST routing", async (t) => {
  // ── Case 1: progress + threaddl → ProgressThread (thread-specific, before generic) ──
  await t.step(
    "progress+threaddl → ProgressThread handler (thread-specific matches before generic Progress)",
    async () => {
      const progressStub = stub(
        Functions.callbackProgressFunctions,
        "progress",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "progress",
          commandType: "threaddl",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(progressStub, 1);
      } finally {
        progressStub.restore();
      }
    },
  );

  // ── Case 2: progress + threaddl-spoiler → ProgressThreadSpoiler ──
  await t.step(
    "progress+threaddl-spoiler → ProgressThreadSpoiler handler",
    async () => {
      const progressStub = stub(
        Functions.callbackProgressFunctions,
        "progress",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "progress",
          commandType: "threaddl-spoiler",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(progressStub, 1);
      } finally {
        progressStub.restore();
      }
    },
  );

  // ── Case 3: progress, no commandType → generic Progress handler ──
  // The Progress pattern is ["progress", P.nullish, P.nullish]: commandType must be
  // null/undefined (non-thread progress callbacks omit commandType).
  await t.step(
    "progress + no commandType → generic Progress handler (P.nullish matches undefined)",
    async () => {
      const progressStub = stub(
        Functions.callbackProgressFunctions,
        "progress",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "progress",
          // commandType intentionally omitted → undefined → P.nullish
        });
        assertEquals(res.status, 204);
        assertSpyCalls(progressStub, 1);
      } finally {
        progressStub.restore();
      }
    },
  );

  // ── Case 4: failure + threaddl → FailureThread (thread-specific before generic) ──
  await t.step(
    "failure+threaddl → FailureThread handler (thread-specific matches before generic Failure)",
    async () => {
      const failureStub = stub(
        Functions.callbackFailureFunctions,
        "failure",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "failure",
          commandType: "threaddl",
          content: "download failed",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(failureStub, 1);
      } finally {
        failureStub.restore();
      }
    },
  );

  // ── Case 5: failure + threaddl-spoiler → FailureThreadSpoiler ──
  await t.step(
    "failure+threaddl-spoiler → FailureThreadSpoiler handler",
    async () => {
      const failureStub = stub(
        Functions.callbackFailureFunctions,
        "failure",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "failure",
          commandType: "threaddl-spoiler",
          content: "download failed",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(failureStub, 1);
      } finally {
        failureStub.restore();
      }
    },
  );

  // ── Case 6: success + dl + single → Success.Dl.Single handler ──
  await t.step(
    "success+dl+single → Success.Dl.Single handler",
    async () => {
      const dlSingleStub = stub(
        Functions.callbackSuccessFunctions.success.dl,
        "single",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "success",
          commandType: "dl",
          actionType: "single",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(dlSingleStub, 1);
      } finally {
        dlSingleStub.restore();
      }
    },
  );

  // ── Case 7: success + threaddl + thread-single → Success.ThreadDl.Single ──
  await t.step(
    "success+threaddl+thread-single → Success.ThreadDl.Single handler",
    async () => {
      const threadDlSingleStub = stub(
        Functions.callbackSuccessFunctions.success.threadDl,
        "single",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "success",
          commandType: "threaddl",
          actionType: "thread-single",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(threadDlSingleStub, 1);
      } finally {
        threadDlSingleStub.restore();
      }
    },
  );

  // ── Case 8: success + dl-spoiler + multi → Success.DlSpoiler.Multi ──
  await t.step(
    "success+dl-spoiler+multi → Success.DlSpoiler.Multi handler",
    async () => {
      const dlSpoilerMultiStub = stub(
        Functions.callbackSuccessFunctions.success.dlSpoiler,
        "multi",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "success",
          commandType: "dl-spoiler",
          actionType: "multi",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(dlSpoilerMultiStub, 1);
      } finally {
        dlSpoilerMultiStub.restore();
      }
    },
  );

  // ── Case 9: success + threaddl-spoiler + thread-multi → Success.ThreadDlSpoiler.Multi ──
  await t.step(
    "success+threaddl-spoiler+thread-multi → Success.ThreadDlSpoiler.Multi handler",
    async () => {
      const threadDlSpoilerMultiStub = stub(
        Functions.callbackSuccessFunctions.success.threadDlSpoiler,
        "multi",
        ok204,
      );
      try {
        const res = await post({
          ...base(),
          status: "success",
          commandType: "threaddl-spoiler",
          actionType: "thread-multi",
        });
        assertEquals(res.status, 204);
        assertSpyCalls(threadDlSpoilerMultiStub, 1);
      } finally {
        threadDlSpoilerMultiStub.restore();
      }
    },
  );

  // ── Case 10: null status → InvalidPost → 400 ──
  await t.step(
    "null status+commandType → InvalidPost pattern → 400",
    async () => {
      const res = await post({ status: null });
      // patternArray = [null, undefined, undefined] → all nullish → InvalidPost
      assertEquals(res.status, 400);
    },
  );
});
