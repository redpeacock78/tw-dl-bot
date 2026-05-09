/**
 * Tests for .github/scripts/retry_curl.sh
 *
 * Starts a local Deno mock HTTP server and verifies:
 *   - 2xx → exit 0 immediately
 *   - retriable errors (5xx/408/429/499) → retries, succeeds on eventual 2xx
 *   - non-retriable error (4xx other than 408/429) → exit 22 immediately
 *   - max retries exhausted → exit 22
 */
import { assertEquals } from "@std/assert";

const SCRIPT = new URL(
  "../../.github/scripts/retry_curl.sh",
  import.meta.url,
).pathname;

// ---------------------------------------------------------------------------
// Mock server helpers
// ---------------------------------------------------------------------------

/** Start a mock HTTP server that responds according to a queue of status codes. */
async function startMockServer(
  responses: number[],
): Promise<{ url: string; close: () => void }> {
  let idx = 0;
  const ac = new AbortController();
  let resolvePort!: (port: number) => void;
  const portP = new Promise<number>((r) => (resolvePort = r));

  const server = Deno.serve(
    { port: 0, signal: ac.signal, onListen: ({ port }) => resolvePort(port) },
    (_req) => {
      const status = responses[idx] ?? responses[responses.length - 1];
      idx++;
      return new Response("ok", { status });
    },
  );

  const port = await portP;
  return {
    url: `http://127.0.0.1:${port}/test`,
    close: () => { ac.abort(); server.finished.catch(() => {}); },
  };
}

/** Run retry_curl.sh with given args and return exit code + stderr. */
async function runScript(
  max: number,
  delay: number,
  url: string,
  extraCurlArgs: string[] = [],
): Promise<{ code: number; stderr: string }> {
  const cmd = new Deno.Command("bash", {
    args: [SCRIPT, String(max), String(delay), "--", url, ...extraCurlArgs],
    stdout: "null",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  return { code, stderr: new TextDecoder().decode(stderr) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("retry_curl.sh", async (t) => {
  // ── Case 1: 200 → exit 0 immediately ──
  await t.step("200 response → exits 0 on first attempt", async () => {
    const mock = await startMockServer([200]);
    try {
      const { code } = await runScript(3, 0, mock.url);
      assertEquals(code, 0);
    } finally {
      mock.close();
    }
  });

  // ── Case 2: 201 (any 2xx) → exit 0 ──
  await t.step("201 response → exits 0 (any 2xx succeeds)", async () => {
    const mock = await startMockServer([201]);
    try {
      const { code } = await runScript(3, 0, mock.url);
      assertEquals(code, 0);
    } finally {
      mock.close();
    }
  });

  // ── Case 3: 503 then 200 → retries, exits 0 ──
  await t.step("503 then 200 → retries once and exits 0", async () => {
    const mock = await startMockServer([503, 200]);
    try {
      const { code } = await runScript(3, 0, mock.url);
      assertEquals(code, 0);
    } finally {
      mock.close();
    }
  });

  // ── Case 4: 400 → exit 22 immediately (non-retriable) ──
  await t.step("400 response → exits 22 immediately (non-retriable)", async () => {
    const mock = await startMockServer([400]);
    try {
      const { code, stderr } = await runScript(3, 0, mock.url);
      assertEquals(code, 22);
      // Should print "Non-retriable error:" message
      assertEquals(stderr.includes("Non-retriable"), true);
    } finally {
      mock.close();
    }
  });

  // ── Case 5: always 503, max=2 → exhausts retries, exits 22 ──
  await t.step(
    "always 503, max=2 → exhausts retries and exits 22",
    async () => {
      const mock = await startMockServer([503, 503, 503]);
      try {
        const { code, stderr } = await runScript(2, 0, mock.url);
        assertEquals(code, 22);
        assertEquals(stderr.includes("Exceeded retries"), true);
      } finally {
        mock.close();
      }
    },
  );

  // ── Case 6: 429 (rate limit) → retriable ──
  await t.step("429 then 200 → treats 429 as retriable, exits 0", async () => {
    const mock = await startMockServer([429, 200]);
    try {
      const { code } = await runScript(3, 0, mock.url);
      assertEquals(code, 0);
    } finally {
      mock.close();
    }
  });
});
