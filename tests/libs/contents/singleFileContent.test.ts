import { assertEquals, assertRejects } from "@std/assert";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import singleFileContent from "../../../src/libs/contents/singleFileContent.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Build the minimum required bodyDataObject fields, then merge extras. */
function makeBody(
  extra: Partial<CallbackTypes.bodyDataObject>,
): CallbackTypes.bodyDataObject {
  return {
    status: "success",
    number: "1",
    startTime: "0",
    channel: "c",
    message: "m",
    token: "t",
    link: "https://example.com",
    type: "video",
    ...extra,
  } as CallbackTypes.bodyDataObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("singleFileContent", async (t) => {
  // ── Case 1: valid body → returns correct fileName ──
  await t.step("valid file1 + name1 → fileName equals name1 value", async () => {
    const fakeFile = new File(["data"], "test.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile, name1: "test.mp4" });
    const result = await singleFileContent(body);
    assertEquals(result.fileName, "test.mp4");
  });

  // ── Case 2: valid body → blobData is the same File instance ──
  await t.step("valid file1 + name1 → blobData is the File object passed in", async () => {
    const fakeFile = new File(["hello"], "clip.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile, name1: "clip.mp4" });
    const result = await singleFileContent(body);
    // blobData should be the Blob/File we passed — same size and type
    assertEquals(result.blobData.size, fakeFile.size);
    assertEquals(result.blobData.type, fakeFile.type);
  });

  // ── Case 3: blobData content round-trips correctly ──
  await t.step("blobData content is readable and matches original", async () => {
    const content = "video-bytes";
    const fakeFile = new File([content], "video.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile, name1: "video.mp4" });
    const result = await singleFileContent(body);
    const text = await result.blobData.text();
    assertEquals(text, content);
  });

  // ── Case 4: missing file1 → rejects ──
  await t.step("missing file1 → rejects with Error", async () => {
    const body = makeBody({ name1: "test.mp4" }); // file1 omitted
    await assertRejects(
      () => singleFileContent(body),
      Error,
      "The number of files given and the number of files expected are different.",
    );
  });

  // ── Case 5: missing name1 → rejects ──
  await t.step("missing name1 → rejects with Error", async () => {
    const fakeFile = new File(["data"], "test.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile }); // name1 omitted
    await assertRejects(
      () => singleFileContent(body),
      Error,
      "The number of files given and the number of files expected are different.",
    );
  });

  // ── Case 6: null body → rejects ──
  await t.step("null body → rejects", async () => {
    await assertRejects(() => singleFileContent(null), Error);
  });
});
