/**
 * Tests for .github/scripts/conv_progress.sh
 *
 * The script monitors a progress log file for SHA256 changes and POSTs a
 * JSON payload to ENDPOINT_URL when the file changes.
 *
 * Strategy:
 *   1. Start a Deno mock HTTP server (port 0)
 *   2. Create a temp progress file
 *   3. Run conv_progress.sh in background via Deno.Command
 *   4. Write new content to the file to trigger SHA256 change detection
 *   5. Wait for the mock server to receive the POST and capture the body
 *   6. Kill the script process
 *   7. Assert JSON structure
 */
import { assertEquals } from "@std/assert";

const SCRIPT = new URL(
  "../../.github/scripts/conv_progress.sh",
  import.meta.url,
).pathname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start a mock HTTP server and return the first captured POST body. */
async function makeCaptureSrv(): Promise<{
  url: string;
  bodyPromise: Promise<string>;
  close: () => void;
}> {
  let resolveBody!: (body: string) => void;
  const bodyPromise = new Promise<string>((r) => (resolveBody = r));
  const ac = new AbortController();
  let resolvePort!: (port: number) => void;
  const portP = new Promise<number>((r) => (resolvePort = r));

  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: ({ port }) => resolvePort(port) },
    async (req) => {
      const body = await req.text();
      resolveBody(body);
      return new Response("ok", { status: 200 });
    },
  );

  const port = await portP;
  return {
    url: `http://127.0.0.1:${port}/callback`,
    bodyPromise,
    close: () => { ac.abort(); server.finished.catch(() => {}); },
  };
}

/** Required env vars (values are non-sensitive test dummies). */
const BASE_ENV: Record<string, string> = {
  RUN_NUMBER: "42",
  START_TIME: "1000000",
  CHANNEL: "111222333",
  MESSAGE: "444555666",
  TOKEN: "fake-token",
  LINK: "https://example.com/status/1",
};

interface RunOpts {
  url: string;
  progressFile: string;
  fileIndex?: string;
  totalFiles?: string;
  phase?: string;
  commandType?: string;
}

/** Start conv_progress.sh in background. Returns kill handle. */
function startScript(opts: RunOpts): Deno.ChildProcess {
  const env: Record<string, string> = {
    ...BASE_ENV,
    ENDPOINT_URL: opts.url,
    PATH: Deno.env.get("PATH") ?? "/usr/bin:/bin",
  };
  if (opts.commandType !== undefined) env.COMMAND_TYPE = opts.commandType;

  const cmd = new Deno.Command("bash", {
    args: [
      SCRIPT,
      opts.progressFile,
      opts.fileIndex ?? "1",
      opts.totalFiles ?? "1",
      opts.phase ?? "🔎Probing...",
    ],
    env,
    stdout: "null",
    stderr: "null",
  });
  return cmd.spawn();
}

/** Wait for bodyPromise with a timeout (ms). */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer!: number;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("conv_progress.sh", async (t) => {
  // ── Case 1: without COMMAND_TYPE → no commandType field in payload ──
  await t.step(
    "without COMMAND_TYPE → JSON payload omits commandType field",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      const progressFile = `${tmpDir}/progress.log`;
      await Deno.writeTextFile(progressFile, "initial");

      const srv = await makeCaptureSrv();
      const proc = startScript({ url: srv.url, progressFile });

      try {
        // Trigger file change
        await new Promise((r) => setTimeout(r, 1200));
        await Deno.writeTextFile(progressFile, "00:00:01/00:01:00(1%)");

        const body = await withTimeout(srv.bodyPromise, 10_000);
        const json = JSON.parse(body);

        assertEquals(json.status, "progress");
        assertEquals(json.number, "42");
        assertEquals(json.channel, "111222333");
        assertEquals(json.token, "fake-token");
        assertEquals("commandType" in json, false);
      } finally {
        proc.kill("SIGKILL");
        await proc.status.catch(() => {});
        srv.close();
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );

  // ── Case 2: with COMMAND_TYPE → commandType field present ──
  await t.step(
    "with COMMAND_TYPE=threaddl → JSON includes commandType field",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      const progressFile = `${tmpDir}/progress.log`;
      await Deno.writeTextFile(progressFile, "initial");

      const srv = await makeCaptureSrv();
      const proc = startScript({
        url: srv.url,
        progressFile,
        commandType: "threaddl",
      });

      try {
        await new Promise((r) => setTimeout(r, 1200));
        await Deno.writeTextFile(progressFile, "00:00:02/00:01:00(2%)");

        const body = await withTimeout(srv.bodyPromise, 10_000);
        const json = JSON.parse(body);

        assertEquals(json.status, "progress");
        assertEquals(json.commandType, "threaddl");
        assertEquals(json.link, "https://example.com/status/1");
      } finally {
        proc.kill("SIGKILL");
        await proc.status.catch(() => {});
        srv.close();
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );

  // ── Case 3: phase label and file index appear in content ──
  await t.step(
    "phase label and file index (2/3) appear in content field",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      const progressFile = `${tmpDir}/progress.log`;
      await Deno.writeTextFile(progressFile, "initial");

      const srv = await makeCaptureSrv();
      const proc = startScript({
        url: srv.url,
        progressFile,
        fileIndex: "2",
        totalFiles: "3",
        phase: "🧪Analyzing...",
      });

      try {
        await new Promise((r) => setTimeout(r, 1200));
        await Deno.writeTextFile(progressFile, "50%");

        const body = await withTimeout(srv.bodyPromise, 10_000);
        const json = JSON.parse(body);

        // content should include phase label and "2 / 3"
        assertEquals(typeof json.content, "string");
        assertEquals(json.content.includes("2 / 3"), true);
        assertEquals(json.content.includes("🧪Analyzing..."), true);
      } finally {
        proc.kill("SIGKILL");
        await proc.status.catch(() => {});
        srv.close();
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );

  // ── Case 4: required env fields (startTime, message) are present ──
  await t.step(
    "required fields startTime and message are present in payload",
    async () => {
      const tmpDir = await Deno.makeTempDir();
      const progressFile = `${tmpDir}/progress.log`;
      await Deno.writeTextFile(progressFile, "initial");

      const srv = await makeCaptureSrv();
      const proc = startScript({ url: srv.url, progressFile });

      try {
        await new Promise((r) => setTimeout(r, 1200));
        await Deno.writeTextFile(progressFile, "progress-update");

        const body = await withTimeout(srv.bodyPromise, 10_000);
        const json = JSON.parse(body);

        assertEquals(json.startTime, "1000000");
        assertEquals(json.message, "444555666");
        assertEquals(json.number, "42");
      } finally {
        proc.kill("SIGKILL");
        await proc.status.catch(() => {});
        srv.close();
        await Deno.remove(tmpDir, { recursive: true });
      }
    },
  );
});
