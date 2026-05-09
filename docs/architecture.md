# Architecture

`tw-dl-bot` is split into two cooperating processes:

1. **Bot service** — a long-running Deno process that talks to Discord (gateway + REST) and exposes an HTTP callback endpoint built with [Hono](https://hono.dev/).
2. **Runner workflow** — a GitHub Actions job (`.github/workflows/run.yml`) that pulls a prebuilt Docker image (`ghcr.io/<owner>/tw-dl-runner:latest`), runs `yt-dlp` against the requested URL, and POSTs progress / success / failure callbacks back to the bot.

The two are decoupled by two HTTP boundaries:

- Bot → GitHub: `POST` to a `repository_dispatch` URL that triggers the runner workflow.
- GitHub Actions → Bot: `POST` to the bot's `/api/callback` endpoint with status updates and the resulting media file.

## End-to-end flow

```mermaid
sequenceDiagram
    participant U as User (Discord)
    participant D as Discord API
    participant B as tw-dl-bot (Deno)
    participant GH as GitHub Actions
    participant R as Runner Container (yt-dlp)

    U->>D: /dl url:<tweet URL>
    D->>B: interactionCreate
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

## Component map

```mermaid
flowchart LR
    subgraph Discord
        U[User]
    end

    subgraph Bot["tw-dl-bot (Deno process)"]
        BOT["src/bot/<br/>discordeno gateway + commands"]
        ROUTER["src/router/<br/>Hono HTTP server"]
        LIBS["src/libs/<br/>webhook, messages, secrets"]
        UTILS["src/utils/<br/>byte/time/blob helpers"]
    end

    subgraph GitHub["GitHub"]
        DISPATCH["repository_dispatch API"]
        ACT["Actions: run.yml"]
        IMG["GHCR: tw-dl-runner image"]
    end

    U -- "/dl, /dl-spoiler, /threaddl (in dev)" --> BOT
    BOT --> LIBS
    LIBS -- "ky.post(DISPATCH_URL)" --> DISPATCH
    DISPATCH --> ACT
    ACT -- "docker pull" --> IMG
    ACT -- "POST /api/callback" --> ROUTER
    ROUTER --> LIBS
    ROUTER --> UTILS
    LIBS -- "discordeno REST" --> U
```

## Module layout

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Boots the bot (`startBot`) and the Hono server (`serve`); mounts the API router at `/api`. |
| `src/bot/bot.ts` | Creates the discordeno bot, registers global slash commands, dispatches `interactionCreate`. |
| `src/bot/commands.ts` | Slash command definitions for `dl`, `dl-spoiler`, `threaddl`. |
| `src/bot/interactionCreate.ts` | Validates URL arguments, posts an initial "Queuing..." follow-up, fires the GitHub `repository_dispatch`. |
| `src/router/index.ts` | Mounts `ping` and `callback` routes under `/api`. |
| `src/router/ping.ts` | Health check at `GET /api/ping` returning `OK!`. |
| `src/router/callback.ts` | `POST /api/callback` — pattern-matches the body and dispatches to success / progress / failure handlers. |
| `src/router/functions/` | Per-status handlers (`success.dl.single`, `success.dl.multi`, `success.dlSpoiler.*`, `progress`, `failure`). |
| `src/router/messages/` | Builds the Discord follow-up payloads sent on success / error. |
| `src/libs/constants.ts` | Centralised constants: HTTP paths, status codes, message colors, command-type / action-type strings. |
| `src/libs/secrets.ts` | Loads required env vars (`DISCORD_TOKEN`, `DISPATCH_URL`, `GITHUB_TOKEN`); fails fast if any are missing. |
| `src/libs/webhook.ts` | `ky.post` wrapper that triggers GitHub `repository_dispatch` with the `client_payload`. |
| `src/libs/messages/` | Builders for progress / success / failure / error embeds. |
| `src/libs/contents/` | Converts callback bodies into `singleFileContent` / `multiFilesContent` blobs. |
| `src/utils/` | Pure helpers: `fileToBlob`, `unitChangeForByte`, `millisecondChangeFormat`. |
| `.github/workflows/build.yml` | Builds and pushes the runner image to GHCR on `push` to `master` and on a daily schedule. |
| `.github/workflows/run.yml` | The `repository_dispatch` consumer that runs `yt-dlp` and posts callbacks. |
| `docker/Dockerfile` | The runner image: Ubuntu base + `ffmpeg`, `aria2`, `jq`, `bc`, `gawk`, `curl`, plus a nightly `yt-dlp`. |

## Status lifecycle

The runner pushes one of three statuses to `/api/callback`:

| `status` | Meaning | Bot behaviour |
| --- | --- | --- |
| `progress` | Step changed (e.g. setup, downloading, converting). | Edits the existing follow-up message with the new content, as long as it is within `EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` (15 minutes). |
| `success` | yt-dlp finished and returned one or more files. | Edits the follow-up to a success embed and attaches the file(s); applies `SPOILER_` prefix when `commandType` is `dl-spoiler`. |
| `failure` | yt-dlp or one of the runner steps failed. | Edits the follow-up to a failure embed. |

The combination of `status`, `commandType` (`dl` / `dl-spoiler`), and `actionType` (`single` / `multi`) selects the handler in `src/libs/custom.ts` (`Custom.CallbackPattern`).

## Why GitHub Actions?

Running `yt-dlp` inside the bot process would couple egress IP, CPU, and disk to the bot host. Pushing the work to GitHub Actions keeps the bot small and stateless, and lets each download run in a fresh container with the latest `yt-dlp` nightly.
