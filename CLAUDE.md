# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

All tasks live in `deno.json`. Run via `deno task <name>`:

- `deno task dev` — local dev with `denon` (auto-reload)
- `deno task run` — start the bot once (`deno run -A`)
- `deno task build` — compile to `build/main` binary
- `deno task cache` — pre-cache imports against `import_map.json`
- `deno task lint` — runs both `deno lint` and `tools/textlint.ts` over `docs/jp/` (Japanese Markdown text lint)
- `deno task lint:fix` — auto-fix textlint findings in `docs/jp/`
- `deno task test` — Deno test suite under `tests/` (test env vars are inlined in the task — see "Test env footgun" below)
- `deno task test:watch` — same with `--watch`
- `deno task test:coverage` — generates `coverage/` directory; CI publishes coverage to Codecov

Single test: `deno test --import-map import_map.json --allow-env --allow-read --allow-run --allow-write --allow-net tests/path/to/file.test.ts`. Set `DISCORD_TOKEN`, `DISPATCH_URL`, `GITHUB_TOKEN` to dummy values (any non-empty string) to satisfy `secrets.ts` validation.

## Architecture

Two cooperating processes share one Deno runtime started from `src/main.ts`:

1. **Discord gateway** — `discordeno`'s `startBot(bot)` connects and dispatches `interactionCreate` events. `bot.events.interactionCreate` (in `src/bot/bot.ts`) first switches on `interaction.type`:
   - `ApplicationCommand` → `Match` on `interaction.data.name`:
     - `/dl`, `/dl-spoiler` → `interactionCreate(props)` (single/multi URL, space-split)
     - `/threaddl`, `/threaddl-spoiler` → `threadInteractionCreate(props)` (responds with a Modal — does **not** defer or do any work yet)
   - `ModalSubmit` → `threadModalSubmit(props)` — extracts URLs from the Paragraph TextInput, then delegates to `runThreadFlow` (creates the thread, posts placeholder messages, fires `repository_dispatch`).
2. **Hono HTTP server** — `serve(app.fetch)` exposes `/api/ping` and `/api/callback`. The callback endpoint receives status updates from GitHub Actions and edits the corresponding Discord message.

Slash commands are **not** registered at `bot.ts` import time. `registerCommands(bot)` is awaited from `main.ts` before `startBot`. This keeps importing `bot.ts` side-effect-free for unit tests — **don't reintroduce a top-level await for command registration in `bot.ts`**.

### End-to-end flow

```
Discord ──slash──▶ bot ──repository_dispatch──▶ GitHub Actions
                                                     │
                                                yt-dlp + ffmpeg
                                                     │
Discord ◀── editMessage / editFollowupMessage ── Hono /api/callback ◀── HTTP POST
```

`run.yml` handles `event_type: download` (single URL, `/dl`, `/dl-spoiler`). `run-thread.yml` handles `event_type: thread-download` and is shared by both `/threaddl` and `/threaddl-spoiler` (the `commandType` field in the dispatch payload is forwarded transparently — the spoiler variant only differs in the eventual filename `SPOILER_` prefix). Its `prepare` job builds a dynamic `matrix.include` from the `links` array, and `download` shards run in parallel.

### Modal flow (/threaddl, /threaddl-spoiler)

Both thread commands take `name` only as a slash option; URLs are entered in the Modal that `threadInteractionCreate` returns. Round-trip plumbing:

- Modal `customId = "<commandType>|<threadName>"` where `commandType` is `threaddl` or `threaddl-spoiler` and `threadName` is sliced to 80 chars (Discord's `customId` cap is 100).
- Modal `title` is sliced to 40 chars (Discord's title cap is 45).
- `threadModalSubmit` validates the prefix against a `Set` allowlist of known command types — unknown prefixes are silently dropped (forged ModalSubmit defence).
- URL extraction regex: `/https?:\/\/[^\s,;]+/g`. Newline/comma/semicolon/space-separated input all work; trailing punctuation is excluded.
- The actual thread creation, `guildId` guard, queue placeholders, and dispatch happen in `src/bot/runThreadFlow.ts` (shared between both spoiler variants).

### Callback routing

`src/router/callback.ts` matches incoming callbacks against the patterns in `src/libs/custom.ts` (`Custom.CallbackPattern.*`). **Order matters** — thread-specific entries must precede the generic ones because first-match wins. The current order is:

1. `Success.ThreadDl.{Single,Multi}` and `Success.ThreadDlSpoiler.{Single,Multi}` — thread variants of success
2. `Success.Dl.{Single,Multi}` / `Success.DlSpoiler.{Single,Multi}` — non-thread success
3. `ProgressThread`, `ProgressThreadSpoiler`, `FailureThread`, `FailureThreadSpoiler` — thread variants of progress/failure
4. `Progress`, `Failure` — generic fallthrough
5. `InvalidPost` — last resort

When adding a new thread-mode command, register its patterns ahead of the generic fallthroughs.

### `useThread` gating (load-bearing)

In `callbackProgressFunctions`, `callbackFailureFunctions`, `successMessage.{single,multi}File`, and `errorMessage`:

```ts
const isEditOriginalMessage = useThread || runTime <= EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
// success/failure/error variants also OR with `oversize !== "true"` on the right side
```

`useThread` is set when `body.commandType` matches **either** `threaddl` or `threaddl-spoiler`. The `useThread ||` short-circuit forces the `editMessage` path (which has no time/oversize limit) for thread placeholders. Without it, long-runtime or oversize results stop editing the placeholder and post a new message instead — breaking the thread's "one tidy line per URL" UX. Tweet videos (especially Premium long-form, plus 10MB-fit re-encoding) routinely exceed `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT = 900000ms` (15 min), so this path is a primary code path, not an edge case.

### Import-map aliases

Use these throughout `src/` (defined in `import_map.json`):
- `@bot/...`, `@router/...`, `@utils/...`, `@libs/...` — directory aliases
- `@libs`, `@router`, `@utils` — barrel-file aliases (`index.ts`)
- `functional` — re-exports `fp-ts/Option|Either|TaskEither|function`, `ts-pattern` (`Match`, `P`), `expressionify` (`If`)

`Constants` (in `src/libs/constants.ts`) is the source of truth for HTTP paths, command-type strings, callback enums, and the 15-min edit window. Avoid hardcoding strings/numbers that already exist there.

## Coding conventions

Full rules are in [`docs/coding-guidelines.md`](./docs/coding-guidelines.md). Key points:

- **Imports** — use `import_map.json` aliases only (no `../` relative paths); prefer barrel `index.ts` targets over leaf files; order: local aliases (`@bot/`, `@libs`, `@router/`, `@utils/`) before external libs (`discordeno`, `functional`, `hono`).
- **Functions** — `const fn = (...): T => { ... }` everywhere; `function` declarations are prohibited.
- **Branching** — `Match(...).with(...).exhaustive()` instead of `if/else`; `If(cond, fn).else(fn)` for simple async conditionals.
- **Constants** — all strings/numbers through `Constants.Namespace.Key`; no inline literals; dot-access only (no destructuring).
- **JSDoc** — required on every exported function; include `@param {Type} name - desc` with the TypeScript type.
- **Error handling** — `.then((i) => i).catch(() => null)` for graceful degradation (identity `.then` is intentional); `finally { obj = null; }` for resource cleanup.
- **Tests** — `Deno.test` + `t.step` hierarchy; `assertEquals` from `@std/assert`; stubs restored in `finally`.
- **Comments** — block comments explain *why*; inline `//` for edge cases; no section-divider comments.

## Tests

Tests live under `tests/`, structured as:
- **`tests/bot/`** — slash command and interaction handler tests
- **`tests/router/`** — callback router and message editing tests
- **`tests/libs/`** — webhook and message builder tests
- **`tests/scripts/`** — shell script and AWK tool tests via subprocess execution

Mocking uses `@std/testing/mock` (`spy`, `stub`); `bot.helpers.*` is replaced with a fake plain object cast to `Bot`, and `globalThis.fetch` is stubbed for `ky`. Tests must avoid importing `src/main.ts` (it triggers `startBot`) — import `interactionCreate.ts`, `commands.ts`, `registerCommands.ts` etc. directly.

Tests run with permissions `--allow-env`, `--allow-read`, `--allow-run`, `--allow-write`, and `--allow-net` to support both TypeScript module testing and subprocess-based script validation.

`Constants` is imported from `@libs/constants.ts` (leaf) rather than the `@libs` barrel inside `updateRAMUsage2BotStatus.ts` to avoid circular-init TDZ when tests import the helper directly.

### Test env footgun

`deno.json` test tasks inline `DISCORD_TOKEN=test-discord-token DISPATCH_URL=https://example.invalid/dispatch GITHUB_TOKEN=test-github-token`. The `unienv` (`npm:@redpeacock78/unienv`) used by `secrets.ts` auto-loads any local `.env`, which **overrides these inline values** — so a developer with a real `.env` will see one test fail (interactionCreate's "single valid URL" attempts a real dispatch). CI passes because no `.env` is checked in. Workaround: temporarily move `.env` aside while running tests locally.

## CI / coverage

- `.github/workflows/test.yml` — lint → test → coverage → upload to Codecov (`codecov/codecov-action@v5`, tokenless via the installed Codecov GitHub App). `Generate lcov report` step guards on `[[ -d coverage ]]` to stay green when prior steps skip.
- `codecov.yml` — `project: auto` / `patch: 70%`, ignores `tools/`, `tests/`, `docker/`, `**/*.test.ts`.
- `tools/` is excluded from `deno lint` (`deno.json` `lint.exclude`) — `tools/textlint.ts` uses `npm:` prefixes that trip default lint rules. Don't try to "fix" these unless you're rewriting that file. `npm:textlint`, `textlint-plugin-jsx`, `textlint-rule-preset-ja-*` are pinned to major versions to avoid a Deno node-compat regression from older `typed-array-byte-offset`.

## Discord constraints worth knowing

- `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` = 900000 ms (Discord's 15-min interaction-token edit window). Standard channel/thread messages have no such limit.
- `Constants.Thread.AUTO_ARCHIVE_DURATION = 1440` (24h, last-activity relative; each shard callback resets it).
- `Constants.Thread.TYPE = 11` = `GUILD_PUBLIC_THREAD`.
- `/threaddl` and `/threaddl-spoiler` are **guild-only** via `dmPermission: false`. Both commands are hidden from DM autocomplete. The guild check in `runThreadFlow.ts` validates both `channelId` **and** `guildId` as a defensive measure because DM interactions still expose `channelId`. (Users with stale cached clients (~1 hour old) may briefly see the commands in their autocomplete from before the permission was set, but the Discord client will reject them locally; our `guildId` guard is a second defense layer.)
- File-size cap: Discord's 10MB per-attachment limit. The runner re-encodes via ffmpeg to fit; spoiler variants (`/dl-spoiler`, `/threaddl-spoiler`) prefix the filename with `SPOILER_` (`Constants.Message.File.Name.SPOILER_PREFIX`).
- **Shard indexing (thread mode only):** `/threaddl` and `/threaddl-spoiler` fire a single `thread-download` dispatch that fans out one job per URL via `run-thread.yml`'s `strategy.matrix`. The `prepare` job assigns each entry a zero-padded `index` field (01, 02, …), which is forwarded as `shardIndex` through the callback pipeline. The bot formats run numbers as `#N-XX` (N = `github.run_number`, XX = `shardIndex`) in Discord embeds to identify which shard processed which URL. Non-thread modes (`/dl`, `/dl-spoiler`) omit `shardIndex`.

## Adding a new slash command

1. Define it in `src/bot/commands.ts` (`Commands` object).
2. Add the command-type string to `Constants.Webhook.Json.ClientPayload.CommandType` and (if it generates callbacks) `Constants.CallbackObject.commandType`.
3. Register it in `src/bot/registerCommands.ts` (sequential `await` — order matters for the test that asserts call order).
4. Wire `bot.events.interactionCreate`'s `Match` (the `ApplicationCommand` branch) to a handler. For thread-style commands that take a Modal, point to `threadInteractionCreate` and add the `commandType` to the `Set` allowlist in `threadModalSubmit.ts`.
5. If it produces callbacks, add patterns to `Custom.CallbackPattern` (thread-specific entries before generic) and matching functions under `src/router/functions/`. Thread-mode callbacks must update the `useThread` predicate to recognise the new `commandType`.
6. Update tests under `tests/bot/` and `tests/libs/` to reflect the new command count and routing — `tests/bot/registerCommands.test.ts` asserts both the count and the sequential await order.
