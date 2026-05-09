# Architecture

`tw-dl-bot` is split into two cooperating processes:

1. **Bot service** — a long-running Deno process that talks to Discord (gateway + REST) and exposes an HTTP callback endpoint built with [Hono](https://hono.dev/).
2. **Runner workflows** — two GitHub Actions workflows that pull a prebuilt Docker image (`ghcr.io/<owner>/tw-dl-runner:latest`), run `yt-dlp` against the requested URL(s), and POST progress / success / failure callbacks back to the bot:
   - `.github/workflows/run.yml` — single-URL pipeline triggered by `repository_dispatch` type `download` (used by `/dl`, `/dl-spoiler`).
   - `.github/workflows/run-thread.yml` — thread / parallel pipeline triggered by `repository_dispatch` type `thread-download`. A `prepare` job builds a strategy matrix from the `links` payload and a `run-with-container` job fans out one shard per URL (used by `/threaddl`).

The two halves are decoupled by two HTTP boundaries:

- Bot → GitHub: `POST` to a `repository_dispatch` URL that triggers one of the runner workflows.
- GitHub Actions → Bot: `POST` to the bot's `/api/callback` endpoint with status updates and the resulting media file.

## End-to-end flow (`/dl`, `/dl-spoiler`)

```mermaid
sequenceDiagram
    participant U as User (Discord)
    participant D as Discord API
    participant B as tw-dl-bot (Deno)
    participant GH as GitHub Actions
    participant R as Runner Container (yt-dlp)

    U->>D: /dl url:<tweet URL>
    D->>B: interactionCreate (Match -> interactionCreate.ts)
    B-->>D: Deferred response + "Queuing..." follow-up
    B->>GH: repository_dispatch (event_type: "download")
    GH->>R: start job (run.yml)
    R-->>B: POST /api/callback (status: progress, "Starting...")
    B->>D: editFollowupMessage (progress)
    R-->>B: POST /api/callback (status: progress, "Setup...")
    B->>D: editFollowupMessage (progress)
    R->>R: yt-dlp download + ffmpeg convert
    R-->>B: POST /api/callback (status: success, multipart file)
    B->>D: editFollowupMessage (success embed + attachment)
```

## End-to-end flow (`/threaddl`)

`/threaddl` creates a Discord thread, posts one placeholder message per URL inside it, and dispatches a single `thread-download` event carrying every URL. The runner workflow fans out one matrix shard per URL; each shard edits its own placeholder via `editMessage` (which is not bounded by the 15-minute interaction-token window).

```mermaid
sequenceDiagram
    participant U as User (Discord)
    participant D as Discord API
    participant B as tw-dl-bot (Deno)
    participant GH as GitHub Actions
    participant R as Runner Containers (yt-dlp, parallel)

    U->>D: /threaddl name:<...> url:<url1> <url2> ...
    D->>B: interactionCreate (Match -> threadInteractionCreate.ts)
    B-->>D: Deferred response
    B->>D: startThreadWithoutMessage (auto-archive 1440min, type 11)
    B->>D: sendMessage (thread) "Queuing..." x N (one per URL)
    B->>GH: repository_dispatch (event_type: "thread-download", links[])
    GH->>GH: prepare job builds matrix from links
    par per-URL shard
        GH->>R: shard 1 (run-thread.yml, matrix.link)
        R-->>B: POST /api/callback (progress / success / failure)
        B->>D: editMessage (in thread)
    and
        GH->>R: shard 2 (run-thread.yml, matrix.link)
        R-->>B: POST /api/callback
        B->>D: editMessage (in thread)
    end
```

## Component map

```mermaid
flowchart LR
    subgraph Discord
        U[User]
    end

    subgraph Bot["tw-dl-bot (Deno process)"]
        BOT["src/bot/<br/>discordeno gateway,<br/>commands, interaction handlers"]
        ROUTER["src/router/<br/>Hono HTTP server"]
        LIBS["src/libs/<br/>webhook + webhookThread,<br/>messages, secrets"]
        UTILS["src/utils/<br/>byte/time/blob helpers"]
    end

    subgraph GitHub["GitHub"]
        DISPATCH["repository_dispatch API"]
        ACT1["Actions: run.yml<br/>(event_type: download)"]
        ACT2["Actions: run-thread.yml<br/>(event_type: thread-download)"]
        IMG["GHCR: tw-dl-runner image"]
    end

    U -- "/dl, /dl-spoiler" --> BOT
    U -- "/threaddl" --> BOT
    BOT --> LIBS
    LIBS -- "ky.post(DISPATCH_URL)<br/>event_type: download" --> DISPATCH
    LIBS -- "ky.post(DISPATCH_URL)<br/>event_type: thread-download" --> DISPATCH
    DISPATCH --> ACT1
    DISPATCH --> ACT2
    ACT1 -- "docker pull" --> IMG
    ACT2 -- "docker pull" --> IMG
    ACT1 -- "POST /api/callback" --> ROUTER
    ACT2 -- "POST /api/callback" --> ROUTER
    ROUTER --> LIBS
    ROUTER --> UTILS
    LIBS -- "discordeno REST" --> U
```

## Module layout

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Boots the bot: calls `await registerCommands(bot)` (Discord REST), then `startBot(bot)`, mounts the Hono app at `/api`, and serves it via `serve` from `std/http/server`. |
| `src/bot/bot.ts` | Creates the discordeno bot and wires `interactionCreate` to dispatch by command name to either `interactionCreate` (`/dl`, `/dl-spoiler`) or `threadInteractionCreate` (`/threaddl`). No more top-level `await` (importing `bot.ts` is now side-effect-free, which is what makes it testable). |
| `src/bot/registerCommands.ts` | Calls `bot.helpers.createGlobalApplicationCommand` for `dlCommand`, `dlSpoilerCommand`, `threadDlCommand`. Invoked from `main.ts` once before `startBot`. |
| `src/bot/commands.ts` | Slash command definitions for `dl`, `dl-spoiler`, `threaddl`. |
| `src/bot/interactionCreate.ts` | Handles `/dl` and `/dl-spoiler`: validates URL arguments, posts an initial "Queuing..." follow-up per URL, fires `webhook` (one dispatch per URL). The `If(...).else(...)` chain is now `await`-ed so the call settles before returning. |
| `src/bot/threadInteractionCreate.ts` | Handles `/threaddl`: requires `guildId`, creates a thread via `startThreadWithoutMessage`, posts one placeholder per URL inside the thread, and fires a single `webhookThread` (carrying all `links`). |
| `src/router/index.ts` | Mounts `ping` and `callback` routes under `/api`. |
| `src/router/ping.ts` | Health check at `GET /api/ping` returning `OK!`. |
| `src/router/callback.ts` | `POST /api/callback` — pattern-matches `[status, commandType, actionType]` and dispatches to success / progress / failure handlers (including the new `Success.ThreadDl.Single|Multi`, `ProgressThread`, `FailureThread` patterns). |
| `src/router/functions/callbackSuccessFunctions.ts` | Shared `handleSingleSuccess(infoObject, spoiler, useThread)` and `handleMultiSuccess(...)` are reused by `dl`, `dlSpoiler`, and `threadDl` — only the `spoiler` and `useThread` flags differ. |
| `src/router/functions/callbackProgressFunctions.ts` | `progress` handler. When `commandType === "threaddl"` it uses `bot.helpers.editMessage(channel, message)` and bypasses the 15-minute follow-up edit window. |
| `src/router/functions/callbackFailureFunctions.ts` | `failure` handler with the same thread-aware branching as `progress`. |
| `src/router/messages/successMessage.ts` | Builds the success message; `useThread` short-circuits both the 15-minute time window and the oversize-fallback gate so the placeholder in the thread is always edited in-place. |
| `src/libs/constants.ts` | Centralised constants: HTTP paths, status codes, message colors, command-type / action-type strings, `Webhook.Json.EVENT_TYPE` (`download`) / `EVENT_TYPE_THREAD` (`thread-download`), `Thread.{AUTO_ARCHIVE_DURATION, TYPE}`. |
| `src/libs/secrets.ts` | Loads required env vars (`DISCORD_TOKEN`, `DISPATCH_URL`, `GITHUB_TOKEN`); fails fast if any are missing. |
| `src/libs/webhook.ts` | Two `ky.post` wrappers: `webhook` (single-URL `download` dispatch) and `webhookThread` (multi-URL `thread-download` dispatch carrying `links: { link, message }[]`). |
| `src/libs/custom.ts` | `Custom.CallbackPattern` triplets including the new `ThreadDl.{Single,Multi}`, `ProgressThread`, `FailureThread`. |
| `src/libs/messages/` | Builders for progress / success / failure / error embeds. |
| `src/libs/contents/` | Converts callback bodies into `singleFileContent` / `multiFilesContent` blobs. |
| `src/utils/` | Pure helpers: `fileToBlob`, `unitChangeForByte`, `millisecondChangeFormat`. |
| `tests/` | Deno test suite mirroring the `src/` tree (e.g. `tests/bot/registerCommands.test.ts`, `tests/libs/isUrl.test.ts`). Tests import the same modules as production code and stub `bot.helpers.*` per test. |
| `.github/workflows/build.yml` | Builds and pushes the runner image to GHCR on `push` to `master` and on a daily schedule. |
| `.github/workflows/run.yml` | `repository_dispatch` (type `download`) consumer that runs `yt-dlp` and posts callbacks. Used by `/dl` and `/dl-spoiler`. |
| `.github/workflows/run-thread.yml` | `repository_dispatch` (type `thread-download`) consumer with a `prepare` job (builds a `strategy.matrix` from `client_payload.links`) and a `run-with-container` job that fans out shards in parallel (`max-parallel: 16`, `fail-fast: false`). Used by `/threaddl`. |
| `.github/workflows/test.yml` | CI: `deno lint` → `deno task test` → `deno task test:coverage`, with the coverage report appended to the GitHub Step Summary. |
| `docker/Dockerfile` | The runner image: Ubuntu base + `ffmpeg`, `aria2`, `jq`, `bc`, `gawk`, `curl`, plus a nightly `yt-dlp`. Shared by both `run.yml` and `run-thread.yml`. |

## Status lifecycle

The runner pushes one of three statuses to `/api/callback`:

| `status` | Meaning | Non-thread (`dl`, `dl-spoiler`) | Thread (`threaddl`) |
| --- | --- | --- | --- |
| `progress` | Step changed (e.g. setup, downloading, converting). | Edits the follow-up via `editFollowupMessage`, only while within `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` (15 minutes). | Edits the placeholder in the thread via `editMessage(channel, message)`. The 15-minute window does not apply. |
| `success` | yt-dlp finished and returned one or more files. | Edits the follow-up to a success embed and attaches the file(s); applies `SPOILER_` prefix when `commandType` is `dl-spoiler`. Falls back to a fresh `sendMessage` if the file is oversized. | Edits the placeholder in the thread to a success embed and attaches the file(s). Both the 15-minute window and the oversize fallback are short-circuited so the message stays in-place inside the thread. |
| `failure` | yt-dlp or one of the runner steps failed. | Edits the follow-up to a failure embed within the 15-minute window, otherwise sends a new message. | Edits the placeholder in the thread to a failure embed (no time limit). |

The combination of `status`, `commandType` (`dl` / `dl-spoiler` / `threaddl`), and `actionType` (`single` / `multi` / `thread-single` / `thread-multi`) selects the handler in `src/libs/custom.ts` (`Custom.CallbackPattern`).

## Why GitHub Actions?

Running `yt-dlp` inside the bot process would couple egress IP, CPU, and disk to the bot host. Pushing the work to GitHub Actions keeps the bot small and stateless, lets each download run in a fresh container with the latest `yt-dlp` nightly, and — for `/threaddl` — provides cheap horizontal fan-out via `strategy.matrix` without any extra orchestration in the bot.
