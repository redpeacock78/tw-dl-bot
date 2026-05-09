import { assertEquals } from "@std/assert";
import ping from "../../src/router/ping.ts";

Deno.test("ping route", async (t) => {
  // ── Case 1: GET /ping → 200 "OK!" ──
  await t.step("GET /ping returns 200 with body 'OK!'", async () => {
    const res = await ping.request("/ping");
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "OK!");
  });

  // ── Case 2: GET /other → 404 (route not registered) ──
  await t.step("GET /unknown returns 404 (not registered)", async () => {
    const res = await ping.request("/unknown");
    assertEquals(res.status, 404);
  });
});
