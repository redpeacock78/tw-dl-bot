import { assertEquals, assertStringIncludes } from "@std/assert";
import { ActivityTypes } from "discordeno";
import { buildRAMUsageStatusPayload } from "../../../src/libs/bot/updateRAMUsage2BotStatus.ts";

Deno.test("buildRAMUsageStatusPayload", async (t) => {
  await t.step(
    "computes (rss + external) / total as a 2-decimal percent string",
    () => {
      // 25 / 100 = 25%, formatted "25.00"
      const payload = buildRAMUsageStatusPayload(20, 5, 100, 1_700_000_000_000);
      assertEquals(payload.activities.length, 1);
      assertEquals(
        payload.activities[0].name,
        "RAM Usage: 25.00%",
      );
      assertEquals(payload.activities[0].type, ActivityTypes.Game);
      assertEquals(payload.activities[0].createdAt, 1_700_000_000_000);
      assertEquals(payload.status, "online");
    },
  );

  await t.step("rounds to exactly 2 decimal places", () => {
    // 1/3 = 33.333...% → "33.33"
    const payload = buildRAMUsageStatusPayload(1, 0, 3, 0);
    assertStringIncludes(payload.activities[0].name, "33.33%");
  });

  await t.step("zero usage yields 0.00%", () => {
    const payload = buildRAMUsageStatusPayload(0, 0, 1024 * 1024, 0);
    assertEquals(payload.activities[0].name, "RAM Usage: 0.00%");
  });

  await t.step("`now` defaults to a numeric timestamp when omitted", () => {
    const before = Date.now();
    const payload = buildRAMUsageStatusPayload(1, 1, 4);
    const after = Date.now();
    const ts = payload.activities[0].createdAt;
    assertEquals(typeof ts, "number");
    assertEquals(ts >= before && ts <= after, true);
  });
});
