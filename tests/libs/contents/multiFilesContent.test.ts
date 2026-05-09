import { assertEquals, assertRejects } from "@std/assert";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import multiFilesContent from "../../../src/libs/contents/multiFilesContent.ts";

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

Deno.test("multiFilesContent", async (t) => {
  // ── Case 1: single file → fileNamesArray length 1, correct name ──
  await t.step("single file (file1+name1) → fileNamesArray has 1 entry with correct name", async () => {
    const fakeFile = new File(["data"], "video.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile, name1: "video.mp4" });
    const result = await multiFilesContent(body);
    assertEquals(result.fileNamesArray.length, 1);
    assertEquals(result.fileNamesArray[0], "video.mp4");
  });

  // ── Case 2: single file → filesArray has correct { name, blob } ──
  await t.step("single file → filesArray[0].name and .blob are correct", async () => {
    const fakeFile = new File(["abc"], "clip.mp4", { type: "video/mp4" });
    const body = makeBody({ file1: fakeFile, name1: "clip.mp4" });
    const result = await multiFilesContent(body);
    assertEquals(result.filesArray.length, 1);
    assertEquals(result.filesArray[0].name, "clip.mp4");
    assertEquals(result.filesArray[0].blob.size, fakeFile.size);
  });

  // ── Case 3: two files → order preserved in both arrays ──
  await t.step("two files → both arrays have 2 entries in insertion order", async () => {
    const file1 = new File(["aaa"], "first.mp4", { type: "video/mp4" });
    const file2 = new File(["bbbb"], "second.mp4", { type: "video/mp4" });
    const body = makeBody({
      file1,
      name1: "first.mp4",
      file2,
      name2: "second.mp4",
    });
    const result = await multiFilesContent(body);
    assertEquals(result.fileNamesArray.length, 2);
    assertEquals(result.filesArray.length, 2);
    assertEquals(result.fileNamesArray[0], "first.mp4");
    assertEquals(result.fileNamesArray[1], "second.mp4");
    assertEquals(result.filesArray[0].name, "first.mp4");
    assertEquals(result.filesArray[1].name, "second.mp4");
  });

  // ── Case 4: blob content round-trips for each file ──
  await t.step("blob content is readable and matches original for each file", async () => {
    const content1 = "bytes-for-one";
    const content2 = "bytes-for-two";
    const file1 = new File([content1], "a.mp4", { type: "video/mp4" });
    const file2 = new File([content2], "b.mp4", { type: "video/mp4" });
    const body = makeBody({ file1, name1: "a.mp4", file2, name2: "b.mp4" });
    const result = await multiFilesContent(body);
    assertEquals(await result.filesArray[0].blob.text(), content1);
    assertEquals(await result.filesArray[1].blob.text(), content2);
  });

  // ── Case 5: names count > files count → throws ──
  await t.step("more names than files → throws mismatch Error", async () => {
    const body = makeBody({
      name1: "a.mp4",
      name2: "b.mp4",
      file1: new File(["x"], "a.mp4", { type: "video/mp4" }),
      // file2 intentionally missing
    });
    await assertRejects(
      () => multiFilesContent(body),
      Error,
      "The number of files given and the number of files expected are different.",
    );
  });

  // ── Case 6: no files at all → throws ──
  await t.step("body with no file/name keys → throws mismatch Error", async () => {
    const body = makeBody({}); // no file* or name* keys
    await assertRejects(
      () => multiFilesContent(body),
      Error,
      "The number of files given and the number of files expected are different.",
    );
  });

  // ── Case 7: null body → throws ──
  await t.step("null body → throws", async () => {
    await assertRejects(() => multiFilesContent(null), Error);
  });

  // ── Case 8: three files → all three entries correct ──
  await t.step("three files → filesArray has 3 entries in order", async () => {
    const files = [
      new File(["1"], "one.mp4", { type: "video/mp4" }),
      new File(["22"], "two.mp4", { type: "video/mp4" }),
      new File(["333"], "three.mp4", { type: "video/mp4" }),
    ];
    const body = makeBody({
      file1: files[0], name1: "one.mp4",
      file2: files[1], name2: "two.mp4",
      file3: files[2], name3: "three.mp4",
    });
    const result = await multiFilesContent(body);
    assertEquals(result.filesArray.length, 3);
    assertEquals(result.filesArray[0].name, "one.mp4");
    assertEquals(result.filesArray[1].name, "two.mp4");
    assertEquals(result.filesArray[2].name, "three.mp4");
  });
});
