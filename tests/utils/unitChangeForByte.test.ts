import { assertEquals } from "@std/assert";
import unitChangeForByte from "../../src/utils/unitChangeForByte.ts";

Deno.test("unitChangeForByte", async (t) => {
  await t.step("renders raw bytes (with `byte` suffix) for sub-KB values", () => {
    assertEquals(unitChangeForByte("0"), "0byte");
    assertEquals(unitChangeForByte("1023"), "1023byte");
  });

  await t.step("converts to KB at the 1024 boundary", () => {
    assertEquals(unitChangeForByte("1024"), "1KB");
    assertEquals(unitChangeForByte("1536"), "1.5KB");
  });

  await t.step("converts to MB at the 1024^2 boundary", () => {
    assertEquals(unitChangeForByte((1024 * 1024).toString()), "1MB");
    assertEquals(
      unitChangeForByte((1024 * 1024 * 2.5).toString()),
      "2.5MB",
    );
  });

  await t.step("converts to GB at the 1024^3 boundary", () => {
    assertEquals(unitChangeForByte((1024 ** 3).toString()), "1GB");
  });

  await t.step("converts to TB at the 1024^4 boundary", () => {
    assertEquals(unitChangeForByte((1024 ** 4).toString()), "1TB");
  });

  await t.step("respects custom decimal precision", () => {
    // 1.123456 MB → with decimal=4 → floor(1.123456 * 10000)/10000 = 1.1234
    const bytes = Math.floor(1.123456 * 1024 * 1024).toString();
    const result = unitChangeForByte(bytes, 4);
    // sanity-check that 4 decimals are preserved (rather than truncated to 2)
    assertEquals(result.endsWith("MB"), true);
    const num = Number(result.replace("MB", ""));
    // truncated to 4 decimals
    assertEquals(num >= 1.1234 && num < 1.1235, true);
  });
});
