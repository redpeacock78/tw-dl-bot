import { assertEquals } from "@std/assert";
import millisecondChangeFormat from "../../src/utils/millisecondChangeFormat.ts";

Deno.test("millisecondChangeFormat", async (t) => {
  await t.step("returns raw `${ms}ms` when value is below 1 second", () => {
    assertEquals(millisecondChangeFormat(0), "0ms");
    assertEquals(millisecondChangeFormat(500), "500ms");
    assertEquals(millisecondChangeFormat(999), "999ms");
  });

  await t.step("formats whole seconds with zero-padded `Ss`", () => {
    assertEquals(millisecondChangeFormat(1_000), "01s");
    assertEquals(millisecondChangeFormat(59_000), "59s");
  });

  await t.step("appends `00s` when result ends with `m`", () => {
    // 1 minute exactly: mins=1, secs=0 → "01m" → padded to "01m00s"
    assertEquals(millisecondChangeFormat(60_000), "01m00s");
  });

  await t.step("formats hours without padding `00s` when result ends in `h`", () => {
    // 1 hour exactly: hours=1, mins=0, secs=0 → "01h"
    assertEquals(millisecondChangeFormat(3_600_000), "01h");
  });

  await t.step("days segment is unpadded; rest segments are zero-padded", () => {
    // 1d 1h 1m 1s
    const ms = 86_400_000 + 3_600_000 + 60_000 + 1_000;
    assertEquals(millisecondChangeFormat(ms), "1d01h01m01s");
  });

  await t.step("skips intermediate zero segments (current behavior)", () => {
    // 1h 0m 1s -> hours=1, mins=0 (skipped), secs=1 → "01h01s"
    const ms = 3_600_000 + 1_000;
    assertEquals(millisecondChangeFormat(ms), "01h01s");
  });
});
