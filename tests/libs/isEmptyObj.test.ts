import { assertEquals } from "@std/assert";
import { isEmptyObj } from "../../src/libs/isEmptyObj.ts";

Deno.test("isEmptyObj", async (t) => {
  await t.step("returns true for an object with no own keys", () => {
    assertEquals(isEmptyObj({}), true);
  });

  await t.step("returns false when the object has at least one entry", () => {
    assertEquals(isEmptyObj({ a: "value" }), false);
  });

  await t.step("returns false even when value is empty string", () => {
    assertEquals(isEmptyObj({ k: "" }), false);
  });
});
