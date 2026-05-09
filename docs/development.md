# Development

## Prerequisites

- [Deno](https://deno.land/) — the bot is written in TypeScript and runs on Deno. The exact version is not pinned via `deno.json`; a recent stable release is fine.
- [denon](https://deno.land/x/denon) — used by `deno task dev` for file-watching reloads (`scripts.json`).
- A Discord application with a bot token.
- A GitHub repository that hosts the runner workflow and accepts `repository_dispatch` events.
- A GitHub Personal Access Token (PAT) with permission to dispatch repository events (see "GitHub token" below).

## Repository layout (top level)

```text
.
├── deno.json               # tasks (dev, lint, build, run, start, cache)
├── scripts.json            # denon config used by `deno task dev`
├── import_map.json         # import map for std + third-party deps
├── src/                    # bot + router + libs + utils + main entry
├── tools/textlint.ts       # custom textlint runner used by `deno task lint`
├── docker/Dockerfile       # runner image (Ubuntu + ffmpeg + yt-dlp)
└── .github/workflows/      # build.yml (image) and run.yml (download job)
```

## Environment variables

The bot fails fast on startup if any of the variables in `Constants.SECRETS` is missing (`src/libs/secrets.ts`).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Discord bot token. Used by discordeno to authenticate the gateway and REST calls. |
| `DISPATCH_URL` | yes | Full URL of the GitHub `repository_dispatch` endpoint, e.g. `https://api.github.com/repos/<owner>/<repo>/dispatches`. |
| `GITHUB_TOKEN` | yes | PAT used as `Authorization: token <...>` when posting to `DISPATCH_URL`. |

A `.env` file at the repository root is read by the runtime (the project uses `@redpeacock78/unienv` to read env vars uniformly across environments). Do **not** commit real secrets — keep `.env` ignored locally and use placeholder values when sharing.

### GitHub token scopes

The PAT used as `GITHUB_TOKEN` must be allowed to trigger `repository_dispatch` on the target repository:

- **Classic PAT:** the `repo` scope (or at minimum `public_repo` for a public repo) plus `workflow` is sufficient.
- **Fine-grained PAT:** grant access to the target repository with **Contents: Read and write** and **Metadata: Read-only**; the dispatch endpoint is gated by repository write access.

The runner workflow itself uses the built-in `GITHUB_TOKEN` (with `packages: write`) to push the runner image to GHCR — that is configured in `build.yml` and is separate from the PAT above.

## Common tasks

All tasks below are defined in `deno.json` (and mirrored in `scripts.json` for denon).

```bash
# Watch-and-reload development server
deno task dev

# Run the bot once (no reload)
deno task run

# Cache imports declared in import_map.json
deno task cache

# Lint TypeScript and run textlint over root files
deno task lint

# Compile a self-contained binary into ./build/main
deno task build

# Run the compiled binary
deno task start
```

`deno task lint` runs:

1. `deno lint` over all TypeScript sources, and
2. `deno run --allow-env --allow-read --allow-sys tools/textlint.ts *` — a custom runner that loads `.textlintrc` and lints the files passed as arguments. The shell glob `*` expands to top-level files only.

### Coverage

```bash
# Run the test suite and produce a `coverage/` profile
deno task test:coverage
```

`deno task test:coverage` writes raw profile data to `coverage/`, then prints a per-file table and generates `coverage/lcov.info` and `coverage/html/index.html`. To browse line-level coverage locally, open the HTML report:

```bash
open coverage/html/index.html   # macOS
xdg-open coverage/html/index.html   # Linux
```

CI (`.github/workflows/test.yml`) additionally runs `deno coverage coverage --lcov > coverage.lcov` and uploads the result to **Codecov** via [`codecov/codecov-action@v5`](https://github.com/codecov/codecov-action). Configuration lives in [`codecov.yml`](../codecov.yml):

- `tools/`, `tests/`, `docker/`, and `**/*.test.ts` are ignored.
- `project` status: `target: auto`, `threshold: 1%` — flags overall coverage drops larger than 1 %.
- `patch` status: `target: 70%`, `threshold: 1%` — every PR's new/modified lines must reach 70 %.

The dashboard is at <https://app.codecov.io/gh/redpeacock78/tw-dl-bot>; the badge in `README.md` mirrors the master-branch percentage.

### What runs at startup

`src/main.ts` imports `bot` from `src/bot/bot.ts`. As a side effect of that import, `bot.ts` runs two top-level `await bot.helpers.createGlobalApplicationCommand(...)` calls that register the `dl` and `dl-spoiler` global slash commands. Then `main.ts`:

1. Loads `Secrets` (fails fast on missing env vars).
2. Calls `startBot(bot)` to open the Discord gateway connection.
3. Mounts the Hono app at `/api` and serves it via the `serve` helper from `std/http/server`.
4. Starts a periodic RAM-usage update on the bot status (`Bot.updateRAMUsage2BotStatus`, every 10 seconds).

The HTTP server listens on `0.0.0.0:8000` by default (the `serve` from `https://deno.land/std@0.193.0/http/server.ts` is the one actually used — not `Deno.serve`). When developing locally, expose this port to the public internet (e.g. with [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)) and set `ENDPOINT_URL` in your GitHub Actions secrets to the public URL of `/api/callback`.

## Troubleshooting

- **`Not all secrets are set.`** — One of `DISCORD_TOKEN`, `DISPATCH_URL`, `GITHUB_TOKEN` is missing or empty.
- **No interactions received** — Ensure the bot has the `applications.commands` and `bot` scopes when invited to the guild.
- **`repository_dispatch` returns 404** — The `DISPATCH_URL` is wrong, the PAT lacks scope, or the workflow file does not declare `on.repository_dispatch.types: [download]`.
- **Callbacks never reach the bot** — `ENDPOINT_URL` (a GH Actions secret) does not point at a publicly reachable `/api/callback`. Check tunnel logs.
- **Follow-up edits stop after 15 minutes** — Discord rate-limits follow-up message edits past the original interaction's lifetime; the bot enforces this via `Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT`.
