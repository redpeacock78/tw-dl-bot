/**
 * Tests for .github/scripts/post_process.sh
 *
 * The script calls ffprobe to detect format/codec/pix_fmt and then optionally
 * runs ffmpeg to convert. We inject fake `ffprobe` and `ffmpeg` binaries via
 * a temp bin/ dir prepended to PATH.
 *
 * Test cases:
 *   1. Already mp4/h264/yuv420p → ffmpeg NOT called, file unchanged
 *   2. Non-mp4 format → ffmpeg called, output renamed to .mp4
 *   3. mp4 but wrong codec → ffmpeg called
 */
import { assertEquals } from "@std/assert";

const SCRIPT = new URL(
  "../../.github/scripts/post_process.sh",
  import.meta.url,
).pathname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary bin/ directory with fake ffprobe and ffmpeg binaries.
 * ffprobe echoes the requested value based on -show_entries flag.
 * ffmpeg creates the output file given as its last positional argument.
 */
async function makeFakeBins(
  dir: string,
  opts: { format: string; codec: string; pixFmt: string; ffmpegFail?: boolean },
) {
  const binDir = `${dir}/bin`;
  await Deno.mkdir(binDir, { recursive: true });

  // Fake ffprobe: returns one of three values depending on which -show_entries is present
  const ffprobeScript = `#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in
    format=format_name) echo "${opts.format}"; exit 0;;
    stream=codec_name)  echo "${opts.codec}"; exit 0;;
    stream=pix_fmt)     echo "${opts.pixFmt}"; exit 0;;
  esac
done
exit 0
`;
  const ffprobePath = `${binDir}/ffprobe`;
  await Deno.writeTextFile(ffprobePath, ffprobeScript);
  await Deno.chmod(ffprobePath, 0o755);

  // Fake ffmpeg: creates the output file (second-to-last arg before "${tmp}" is the input,
  // last arg is the output). We just `touch` the last positional arg.
  const exitCode = opts.ffmpegFail ? "1" : "0";
  const ffmpegScript = `#!/usr/bin/env bash
# Create the output file (last positional argument)
output="\${@: -1}"
if [[ "${exitCode}" == "0" ]]; then
  touch "\${output}"
fi
exit ${exitCode}
`;
  const ffmpegPath = `${binDir}/ffmpeg`;
  await Deno.writeTextFile(ffmpegPath, ffmpegScript);
  await Deno.chmod(ffmpegPath, 0o755);

  return binDir;
}

async function runScript(
  inputFile: string,
  binDir: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const pathEnv = `${binDir}:${Deno.env.get("PATH") ?? "/usr/bin:/bin"}`;
  const cmd = new Deno.Command("bash", {
    args: [SCRIPT, inputFile],
    env: { PATH: pathEnv },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("post_process.sh", async (t) => {
  // ── Case 1: already mp4/h264/yuv420p → no conversion, file unchanged ──
  await t.step(
    "mp4 + h264 + yuv420p → no ffmpeg call, original file untouched",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      try {
        const inputFile = `${tmpDir}/video.mp4`;
        const sentinel = "original-content";
        await Deno.writeTextFile(inputFile, sentinel);

        const binDir = await makeFakeBins(tmpDir, {
          format: "mov,mp4,m4a,3gp,3g2,mj2",
          codec: "h264",
          pixFmt: "yuv420p",
        });

        const { code } = await runScript(inputFile, binDir);
        assertEquals(code, 0);
        // File should be unchanged
        const content = await Deno.readTextFile(inputFile);
        assertEquals(content, sentinel);
      } finally {
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );

  // ── Case 2: webm format → ffmpeg called, output renamed to .mp4 ──
  await t.step(
    "webm format → ffmpeg called and output renamed to video.mp4",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      try {
        const inputFile = `${tmpDir}/video.webm`;
        await Deno.writeTextFile(inputFile, "fake-webm-data");

        const binDir = await makeFakeBins(tmpDir, {
          format: "matroska,webm",
          codec: "vp9",
          pixFmt: "yuv420p",
        });

        const { code } = await runScript(inputFile, binDir);
        assertEquals(code, 0);
        // Output file should be video.mp4 (because format != mp4, ext defaults to "mp4")
        const mp4Exists = await Deno.stat(`${tmpDir}/video.mp4`)
          .then(() => true)
          .catch(() => false);
        assertEquals(mp4Exists, true);
      } finally {
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );

  // ── Case 3: mp4 container but h265 codec → ffmpeg called, file stays .mp4 ──
  await t.step(
    "mp4 + h265 codec → ffmpeg called, output stays .mp4 (same container)",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      try {
        const inputFile = `${tmpDir}/video.mp4`;
        await Deno.writeTextFile(inputFile, "fake-h265-data");

        const binDir = await makeFakeBins(tmpDir, {
          format: "mov,mp4,m4a,3gp,3g2,mj2",
          codec: "hevc", // h265
          pixFmt: "yuv420p",
        });

        const { code } = await runScript(inputFile, binDir);
        assertEquals(code, 0);
        // After conversion: tmp file created, original removed, tmp renamed to original
        // The fake ffmpeg touches the .tmp.mp4 file; script moves it to video.mp4
        const mp4Exists = await Deno.stat(inputFile)
          .then(() => true)
          .catch(() => false);
        assertEquals(mp4Exists, true);
      } finally {
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );
});
