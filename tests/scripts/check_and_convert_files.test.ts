/**
 * Tests for .github/scripts/check_and_convert_files.sh.
 *
 * The conversion branch uses fake ffprobe/ffmpeg/progress commands so the
 * size decision and two-pass orchestration can run without real media.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";

const SCRIPT = new URL(
  "../../.github/scripts/check_and_convert_files.sh",
  import.meta.url,
).pathname;

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

async function makeFakeTools(directory: string): Promise<string> {
  const binDirectory = `${directory}/bin`;
  await Deno.mkdir(binDirectory, { recursive: true });

  const tools: Record<string, string> = {
    ffprobe: `#!/usr/bin/env bash
for arg in "$@"; do
  case "\${arg}" in
    format=duration) printf '10\\n'; exit 0;;
    stream=width,height,avg_frame_rate) printf '640x480x30/1\\n'; exit 0;;
  esac
done
exit 0
`,
    ffmpeg: `#!/usr/bin/env bash
output="\${@: -1}"
if [[ "\${output}" != /dev/null ]]; then
  mkdir -p "$(dirname -- "\${output}")"
  printf 'converted' > "\${output}"
fi
`,
    tee: `#!/usr/bin/env bash
cat > /dev/null
`,
    "conv_progress.sh": `#!/usr/bin/env bash
exit 0
`,
  };

  for (const [name, content] of Object.entries(tools)) {
    const path = `${binDirectory}/${name}`;
    await Deno.writeTextFile(path, content);
    await Deno.chmod(path, 0o755);
  }
  return binDirectory;
}

async function runScript(
  workspace: string,
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const result = await new Deno.Command("bash", {
    args: [SCRIPT],
    env: {
      PATH: Deno.env.get("PATH") ?? "/usr/bin:/bin",
      GITHUB_WORKSPACE: workspace,
      ...env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: result.code,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

Deno.test("check_and_convert_files.sh", async (t) => {
  await t.step("composite action delegates to the maintained script", async () => {
    const action = await Deno.readTextFile(
      new URL(
        "../../.github/actions/check-and-convert-files/action.yml",
        import.meta.url,
      ),
    );

    assertEquals(action.includes("run: |"), false);
    assertStringIncludes(
      action,
      'run: bash "${GITHUB_WORKSPACE}/.github/scripts/check_and_convert_files.sh"',
    );
  });

  await t.step("skips conversion when all files fit", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const workspace = `${directory}/workspace`;
      await Deno.mkdir(`${workspace}/download`, { recursive: true });
      await Deno.writeTextFile(`${workspace}/download/clip.mp4`, "small");

      const result = await runScript(workspace, {});

      assertEquals(result.code, 0);
      assertEquals(
        await Deno.stat(`${workspace}/conv`).then(() => true).catch(() => false),
        false,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  await t.step("converts an oversized file through all phases", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const workspace = `${directory}/workspace`;
      await Deno.mkdir(`${workspace}/download`, { recursive: true });
      const input = `${workspace}/download/clip.mkv`;
      await Deno.writeTextFile(input, "x");
      await Deno.truncate(input, 10485761);
      const progressAwk = `${workspace}/progress.awk`;
      await Deno.writeTextFile(progressAwk, "{ print > \"/dev/null\" }\n");
      const binDirectory = await makeFakeTools(directory);

      const result = await runScript(workspace, {
        PATH: `${binDirectory}:${Deno.env.get("PATH") ?? "/usr/bin:/bin"}`,
        CONV_PROGRESS: `${binDirectory}/conv_progress.sh`,
        FFMPEG_THREADS: "1",
        PROGRESS_AWK: progressAwk,
      });

      assertEquals(result.code, 0, result.stderr);
      assertEquals(
        await Deno.readTextFile(`${workspace}/conv/clip.mp4`),
        "converted",
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
