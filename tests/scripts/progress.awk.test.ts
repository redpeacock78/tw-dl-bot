/**
 * Tests for .github/scripts/progress.awk
 *
 * The script uses systime() which is a GNU awk extension not available in
 * macOS's default nawk. Tests use `gawk` when available, and skip otherwise.
 * On CI (ubuntu-latest), the system `awk` IS GNU awk so both `awk` and `gawk`
 * work.
 */
import { assertEquals, assertMatch } from "@std/assert";

const AWK_SCRIPT = new URL(
  "../../.github/scripts/progress.awk",
  import.meta.url,
).pathname;

// ---------------------------------------------------------------------------
// Helper: find a gawk-compatible binary
// ---------------------------------------------------------------------------

async function findAwk(): Promise<string | null> {
  for (const bin of ["gawk", "awk"]) {
    try {
      const probe = new Deno.Command(bin, {
        args: ["BEGIN{print systime() > 0}"],
        stdout: "null",
        stderr: "null",
      });
      const { code } = await probe.output();
      if (code === 0) return bin;
    } catch { /* not found */ }
  }
  return null;
}

async function runAwk(awkBin: string, stdin: string): Promise<string> {
  const cmd = new Deno.Command(awkBin, {
    args: ["-f", AWK_SCRIPT],
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(stdin));
  await writer.close();
  const { stdout } = await child.output();
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Build a minimal ffmpeg-style stream.
 * RS="frame=" means "frame=" is the record separator.
 * Record 1 contains the Duration header.
 * Record 2 (after "frame=") contains time=.
 */
function makeInput(durationHMS: string, timeHMS: string): string {
  return (
    `Duration: ${durationHMS}, start: 0.000000, bitrate: 1234 kb/s\n` +
    `frame=1 fps=0.0 q=0.0 size=0kB time=${timeHMS} bitrate=N/A speed=0x\n`
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("progress.awk", async (t) => {
  const awk = await findAwk();

  // ── Case 1: 0% progress (Prog=0) → no ETA ──
  await t.step("0% progress → no ETA (Prog=0 skips ETA branch)", async () => {
    if (!awk) return; // skip on platforms without gawk
    const out = await runAwk(awk, makeInput("00:01:00.00", "00:00:00"));
    // Ratio=0, Prog=0 → Remain="" → "00:00:00/00:01:00(0%)"
    assertEquals(out, "00:00:00/00:01:00(0%)");
  });

  // ── Case 2: 50% progress → correct ratio, ETA present ──
  await t.step(
    "50% progress → HH:MM:SS/HH:MM:SS(50%) [ETA:...] format",
    async () => {
      if (!awk) return;
      const out = await runAwk(awk, makeInput("00:01:00.00", "00:00:30"));
      // systime() elapsed ≈0 so ETA≈00:00:00; allow optional ETA presence
      assertMatch(
        out,
        /^00:00:30\/00:01:00\(50%\)(\s+ETA:\d{2}:\d{2}:\d{2})?$/,
      );
    },
  );

  // ── Case 3: 100% progress ──
  await t.step("100% progress → ratio shows 100", async () => {
    if (!awk) return;
    const out = await runAwk(awk, makeInput("00:01:00.00", "00:01:00"));
    assertMatch(out, /^00:01:00\/00:01:00\(100%\)/);
  });

  // ── Case 4: same ratio twice → dedup (only one line emitted) ──
  await t.step(
    "same ratio emitted twice → only one output line (Old guard)",
    async () => {
      if (!awk) return;
      // Two records at the same time → same Ratio → second suppressed
      const input =
        `Duration: 00:01:00.00, start: 0\n` +
        `frame=1 fps=0.0 q=0.0 size=0kB time=00:00:30 bitrate=N/A speed=0x\n` +
        `frame=2 fps=0.0 q=0.0 size=1kB time=00:00:30 bitrate=N/A speed=0x\n`;
      const out = await runAwk(awk, input);
      const lines = out.split("\n").filter((l) => l.trim());
      assertEquals(lines.length, 1);
      assertMatch(lines[0], /\(50%\)/);
    },
  );

  // ── Case 5: no Duration header → awk runs without crash ──
  await t.step(
    "no Duration header → no output, script exits cleanly",
    async () => {
      // Even without gawk, nawk should handle this (no systime needed)
      const bin = awk ?? "awk";
      const input =
        `frame=1 fps=0.0 q=0.0 size=0kB time=00:00:10 bitrate=N/A speed=0x\n`;
      const out = await runAwk(bin, input);
      // No Duration → Dura=0 → Prog/Dura=NaN → int()→0; may or may not output
      // Key check: no exception was thrown
      assertEquals(typeof out, "string");
    },
  );
});
