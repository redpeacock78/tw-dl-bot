# Deployment

> 日本語版: [./jp/deployment.md](./jp/deployment.md)

The deployable surface of this project has two pieces:

1. The **bot service** (`src/main.ts`) — a long-running Deno process that must reach Discord and accept inbound HTTP from GitHub Actions.
2. The **runner image** (`docker/Dockerfile`) — a Docker image consumed by both `.github/workflows/run.yml` (single-URL) and `.github/workflows/run-thread.yml` (matrix fan-out for `/threaddl`). It is rebuilt automatically by `.github/workflows/build.yml`.

## 1. Runner image

The runner is an Ubuntu-based image with the tools `yt-dlp` needs at runtime: `ffmpeg`, `aria2`, `jq`, `bc`, `gawk`, `curl`. `yt-dlp` itself is downloaded as a stable binary then immediately switched to the latest nightly build inside the same `RUN` layer.

### Automatic build (default)

`.github/workflows/build.yml` builds and pushes `ghcr.io/<owner>/tw-dl-runner:latest`:

- on every `push` to `master`, and
- on a daily schedule (`0 15 * * *` UTC).

It logs in to GHCR with the workflow's built-in `GITHUB_TOKEN` (which is granted `packages: write` in the job permissions block) and runs `docker build -f docker/Dockerfile -t <image> ./docker` followed by `docker push`.

### Manual build (for testing)

```bash
IMAGE=ghcr.io/<owner>/tw-dl-runner:latest
docker build -f docker/Dockerfile -t "${IMAGE}" ./docker
echo "${CR_PAT}" | docker login ghcr.io -u "<your-username>" --password-stdin
docker push "${IMAGE}"
```

Both runner workflows always pull `:latest`, so a successful push is enough to roll out a new runner — no application redeploy is required.

## 2. Bot service

The bot can be deployed in any environment that can:

- reach `discord.com` (gateway + REST),
- reach `api.github.com` to POST `repository_dispatch` events,
- accept inbound HTTPS on `/api/callback` from `github.com`'s Actions runners.

### Build

```bash
deno task build
```

This produces a self-contained executable at `./build/main` via `deno compile -A --import-map import_map.json -o build/main src/main.ts`. The compile uses `-A` (all permissions) — review your hosting environment's expectations before running.

### Run

```bash
DISCORD_TOKEN=...
DISPATCH_URL=https://api.github.com/repos/<owner>/<repo>/dispatches
GITHUB_TOKEN=...
deno task start   # runs ./build/main
```

Or, without compiling:

```bash
deno task run
```

The Hono server is served via the `serve` helper from `std/http/server` (`https://deno.land/std@0.193.0/http/server.ts`), which listens on `0.0.0.0:8000` by default.

### Required environment variables

See [development.md](./development.md#environment-variables) for the same table; the variables are identical between local development and production. Treat the PAT (`GITHUB_TOKEN`) as a long-lived credential — rotate it on a schedule.

### Reverse proxy / TLS

Discord and GitHub both require HTTPS for webhook-style endpoints. Terminate TLS at a reverse proxy (Caddy, nginx, Cloudflare Tunnel, fly.io edge, etc.) and forward to the bot's HTTP port. The callback path must be reachable as `https://<your-host>/api/callback`.

### GitHub Actions secret

Set `ENDPOINT_URL` in the **target repository's** Actions secrets to the public URL of the bot's callback endpoint, e.g.:

```text
ENDPOINT_URL = https://bot.example.com/api/callback
```

Both `run.yml` and `run-thread.yml` use this when posting progress / success / failure updates.

### Bot permissions in Discord

For `/dl` and `/dl-spoiler` the bot needs the standard message-send and attachment scopes.

For `/threaddl` and `/threaddl-spoiler` the bot needs **two distinct** permissions in the source guild text channel. They fail in **different** ways and produce **different** user-visible symptoms — operators must verify both, not just check that no error embed appeared:

| Missing permission | Failure path | What the user sees |
| --- | --- | --- |
| **Create Public Threads** | `bot.helpers.startThreadWithoutMessage(...)` rejects at the REST layer; `runThreadFlow`'s `.catch` posts an error embed and stops. | A `Failed to create thread: <reason>` error embed in the source channel. The thread is never created; nothing is dispatched. |
| **Send Messages in Threads** | The thread *is* created (the two permissions are independent), but every per-URL `bot.helpers.sendMessage(thread.id, ...)` placeholder rejects. The bot swallows each rejection silently (`.catch((): null => null)`) and short-circuits on `links.length === 0`. | A `🧵 Created thread <#thread-id> for N URL(s).` follow-up appears in the source channel and an empty thread is created — but **no error embed**, and the bot never dispatches the runner workflow. |

> **Operator note.** If `/threaddl` (or `/threaddl-spoiler`) looks like it "ran without error" but nothing ever appears in the new thread, suspect the second row first.

## Health check

```http
GET /api/ping  -> 200 OK with body "OK!"
```

Use this for uptime checks or load-balancer health probes.

## Rolling out changes

| Change | What to redeploy |
| --- | --- |
| TypeScript source under `src/` | Bot service. |
| `docker/Dockerfile` | Runner image (push to `master` triggers `build.yml`). No bot redeploy needed. |
| `.github/workflows/run.yml` or `run-thread.yml` | Nothing — the workflows are read from the default branch on each dispatch. |
| `.github/workflows/test.yml` | Nothing — runs on `pull_request` and on `push` to `master`. |
| Slash command additions / removals | Bot service. `createGlobalApplicationCommand` is called by `registerCommands` at startup. Global commands can take up to an hour to propagate. |

## Operational notes

- The bot updates its presence with current RAM usage every 10 seconds (`UPDATE_BOT_STATUS_INTERVAL`).
- For `/dl` / `/dl-spoiler`: Discord follow-up messages can only be edited for 15 minutes after the original interaction (`EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT`); long-running downloads will stop receiving progress edits past that window even though the workflow keeps running. `/threaddl` placeholders are edited via `editMessage` (a regular channel message edit) and are not affected by this 15-minute window.
- The runner image is intentionally rebuilt nightly so that `yt-dlp` and its dependencies stay current with site changes.
- `run-thread.yml` runs at most 16 shards in parallel (`strategy.max-parallel: 16`, `fail-fast: false`). Failed shards still let other URLs complete.
