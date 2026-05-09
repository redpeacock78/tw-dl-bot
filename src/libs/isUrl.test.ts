import { assertEquals } from "@std/assert";
import { isUrl } from "./isUrl.ts";

Deno.test("isUrl", async (t) => {
  await t.step("accepts well-formed http/https URLs", () => {
    assertEquals(isUrl("https://example.com"), true);
    assertEquals(isUrl("http://example.com/path?q=1&r=2"), true);
    assertEquals(
      isUrl("https://twitter.com/user/status/1234567890"),
      true,
    );
  });

  await t.step("rejects empty string", () => {
    assertEquals(isUrl(""), false);
  });

  await t.step("rejects strings with no scheme", () => {
    assertEquals(isUrl("example.com"), false);
    assertEquals(isUrl("/relative/path"), false);
  });

  await t.step("rejects unsupported schemes", () => {
    // regex only allows http(s)://
    assertEquals(isUrl("ftp://example.com"), false);
    assertEquals(isUrl("ws://example.com"), false);
  });

  await t.step("rejects URLs containing non-ASCII (e.g. Japanese) chars", () => {
    // current regex character-class does not include unicode letters
    assertEquals(isUrl("https://日本.jp"), false);
    assertEquals(isUrl("https://example.com/パス"), false);
  });

  await t.step("rejects strings that look like URLs but contain whitespace", () => {
    assertEquals(isUrl("https://example .com"), false);
    assertEquals(isUrl("https://example.com /x"), false);
  });
});
