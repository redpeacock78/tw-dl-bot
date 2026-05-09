# Deployment

The deployable surface of this project has two pieces:

1. The **bot service** (`src/main.ts`) — a long-running Deno process that must reach Discord and accept inbound HTTP from GitHub Actions.
2. The **runner image** (`docker/Dockerfile`) — a Docker image consumed by `.github/workflows/run.yml`. It is rebuilt automatically by `.github/workflows/build.yml`.

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

The runner workflow always pulls `:latest`, so a successful push is enough to roll out a new runner — no application redeploy is required.

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

The Hono server listens on the port chosen by `Deno.serve` (default `8000`).

### Required environment variables

See [development.md](./development.md#environment-variables) for the same table; the variables are identical between local development and production. Treat the PAT (`GITHUB_TOKEN`) as a long-lived credential — rotate it on a schedule.

### Reverse proxy / TLS

Discord and GitHub both require HTTPS for webhook-style endpoints. Terminate TLS at a reverse proxy (Caddy, nginx, Cloudflare Tunnel, fly.io edge, etc.) and forward to the bot's HTTP port. The callback path must be reachable as `https://<your-host>/api/callback`.

### GitHub Actions secret

Set `ENDPOINT_URL` in the **target repository's** Actions secrets to the public URL of the bot's callback endpoint, e.g.:

```
ENDPOINT_URL = https://bot.example.com/api/callback
```

The runner workflow uses this when posting progress / success / failure updates.

## Health check

```
GET /api/ping  -> 200 OK with body "OK!"
```

Use this for uptime checks or load-balancer health probes.

## Rolling out changes

| Change | What to redeploy |
| --- | --- |
| TypeScript source under `src/` | Bot service. |
| `docker/Dockerfile` | Runner image (push to `master` triggers `build.yml`). No bot redeploy needed. |
| `.github/workflows/run.yml` | Nothing — the workflow is read from the default branch on each dispatch. |
| Slash command additions / removals | Bot service. `createGlobalApplicationCommand` is called at startup. Global commands can take up to an hour to propagate. |

## Operational notes

- The bot updates its presence with current RAM usage every 10 seconds (`UPDATE_BOT_STATUS_INTERVAL`).
- Discord follow-up messages can only be edited for 15 minutes after the original interaction (`EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT`); long-running downloads will stop receiving progress edits past that window even though the workflow keeps running.
- The runner image is intentionally rebuilt nightly so that `yt-dlp` and its dependencies stay current with site changes.
