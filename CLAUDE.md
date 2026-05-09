# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

All tasks live in `deno.json`. Run via `deno task <name>`:

- `deno task dev` — local dev with `denon` (auto-reload)
- `deno task run` — start the bot once (`deno run -A`)
- `deno task build` — compile to `build/main` binary
- `deno task cache` — pre-cache imports against `import_map.json`
- `deno task lint` — runs both `deno lint` and `tools/textlint.ts` (Markdown text lint)
- `deno task test` — Deno test suite under `tests/` (test env vars are inlined in the task — see "Test env footgun" below)
- `deno task test:watch` — same with `--watch`
- `deno task test:coverage` — generates `coverage/` directory; CI publishes coverage to Codecov

Single test: `deno test --import-map import_map.json --allow-env --allow-read tests/path/to/file.test.ts`. Set `DISCORD_TOKEN`, `DISPATCH_URL`, `GITHUB_TOKEN` to dummy values (any non-empty string) to satisfy `secrets.ts` validation.

## Architecture

Two cooperating processes share one Deno runtime started from `src/main.ts`:

1. **Discord gateway** — `discordeno`'s `startBot(bot)` connects and dispatches `interactionCreate` events. `bot.events.interactionCreate` (in `src/bot/bot.ts`) `Match`-routes by `interaction.data.name`:
   - `/dl`, `/dl-spoiler` → `interactionCreate(props)` (single/multi URL, space-split)
   - `/threaddl` → `threadInteractionCreate(props)` (creates a Discord thread, posts queued placeholders, fires `repository_dispatch`)
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

`run.yml` handles `event_type: download` (single URL, `/dl`, `/dl-spoiler`). `run-thread.yml` handles `event_type: thread-download` (`/threaddl`) — its `prepare` job builds a dynamic `matrix.include` from the `links` array, and `download` shards run in parallel.

### Callback routing

`src/router/functions/index.ts` matches incoming callbacks against the patterns in `src/libs/custom.ts` (`Custom.CallbackPattern.*`). **Order matters**: thread-specific entries (`Success.ThreadDl.*`, `FailureThread`, `ProgressThread`) must precede the generic `Failure`/`Progress` patterns — first-match wins.

### `useThread` gating (load-bearing)

In `callbackProgressFunctions`, `callbackFailureFunctions`, `successMessage.{single,multi}File`, and `errorMessage`:

```ts
const isEditOriginalMessage = useThread || runTime <= EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT;
// success/failure/error variants also OR with `oversize !== "true"` on the right side
```

The `useThread ||` short-circuit forces the `editMessage` path (which has no time/oversize limit) for `/threaddl` placeholders. Without it, long-runtime or oversize results stop editing the placeholder and post a new message instead — breaking the thread's "one tidy line per URL" UX. Tweet videos (especially Premium long-form, plus 10MB-fit re-encoding) routinely exceed `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT = 900000ms` (15 min), so this path is a primary code path, not an edge case.

### Import-map aliases

Use these throughout `src/` (defined in `import_map.json`):
- `@bot/...`, `@router/...`, `@utils/...`, `@libs/...` — directory aliases
- `@libs`, `@router`, `@utils` — barrel-file aliases (`index.ts`)
- `functional` — re-exports `fp-ts/Option|Either|TaskEither|function`, `ts-pattern` (`Match`, `P`), `expressionify` (`If`)

`Constants` (in `src/libs/constants.ts`) is the source of truth for HTTP paths, command-type strings, callback enums, and the 15-min edit window. Avoid hardcoding strings/numbers that already exist there.

## Tests

Tests live under `tests/`, mirroring `src/` structure (e.g. `tests/bot/interactionCreate.test.ts`). Mocking uses `@std/testing/mock` (`spy`, `stub`); `bot.helpers.*` is replaced with a fake plain object cast to `Bot`, and `globalThis.fetch` is stubbed for `ky`. Tests must avoid importing `src/main.ts` (it triggers `startBot`) — import `interactionCreate.ts`, `commands.ts`, `registerCommands.ts` etc. directly.

`Constants` is imported from `@libs/constants.ts` (leaf) rather than the `@libs` barrel inside `updateRAMUsage2BotStatus.ts` to avoid circular-init TDZ when tests import the helper directly.

### Test env footgun

`deno.json` test tasks inline `DISCORD_TOKEN=test-discord-token DISPATCH_URL=https://example.invalid/dispatch GITHUB_TOKEN=test-github-token`. The `unienv` (`npm:@redpeacock78/unienv`) used by `secrets.ts` auto-loads any local `.env`, which **overrides these inline values** — so a developer with a real `.env` will see one test fail (interactionCreate's "single valid URL" attempts a real dispatch). CI passes because no `.env` is checked in. Workaround: temporarily move `.env` aside while running tests locally.

## CI / coverage

- `.github/workflows/test.yml` — lint → test → coverage → upload to Codecov (`codecov/codecov-action@v5`, tokenless via the installed Codecov GitHub App). `Generate lcov report` step guards on `[[ -d coverage ]]` to stay green when prior steps skip.
- `codecov.yml` — `project: auto` / `patch: 70%`, ignores `tools/`, `tests/`, `docker/`, `**/*.test.ts`.
- `tools/` is excluded from `deno lint` (`deno.json` `lint.exclude`) — `tools/textlint.ts` uses `npm:` prefixes and unversioned imports that trip default lint rules. Don't try to "fix" these unless you're rewriting that file.

## Discord constraints worth knowing

- `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` = 900000 ms (Discord's 15-min interaction-token edit window). Standard channel/thread messages have no such limit.
- `Constants.Thread.AUTO_ARCHIVE_DURATION = 1440` (24h, last-activity relative; each shard callback resets it).
- `Constants.Thread.TYPE = 11` = `GUILD_PUBLIC_THREAD`.
- `/threaddl` requires a guild text channel — `threadInteractionCreate.ts` checks both `channelId` **and** `guildId` because DM interactions still expose `channelId`.
- File-size cap: Discord's 10MB per-attachment limit. The runner re-encodes via ffmpeg to fit; spoiler variant prefixes the filename with `SPOILER_` (`Constants.Message.File.Name.SPOILER_PREFIX`).

## Adding a new slash command

1. Define it in `src/bot/commands.ts` (`Commands` object).
2. Add the command-type string to `Constants.Webhook.Json.ClientPayload.CommandType` and (if it generates callbacks) `Constants.CallbackObject.commandType`.
3. Register it in `src/bot/registerCommands.ts` (sequential `await` — order matters for the test that asserts call order).
4. Wire `bot.events.interactionCreate`'s `Match` to a handler.
5. If it produces callbacks, add patterns to `Custom.CallbackPattern` (thread-specific entries before generic) and matching functions under `src/router/functions/`.
6. Update tests under `tests/bot/` and `tests/libs/` to reflect the new command count and routing.
