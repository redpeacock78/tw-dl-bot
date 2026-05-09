# tw-dl-bot Documentation

> 日本語版: [./jp/README.md](./jp/README.md)

This directory contains the developer-facing documentation for **tw-dl-bot**, a Deno + TypeScript Discord bot that downloads videos from Tweets via yt-dlp running in GitHub Actions.

## Contents

- [Architecture](./architecture.md) — High-level system overview and data flow between Discord, the bot, GitHub Actions (`run.yml` + `run-thread.yml`), and yt-dlp.
- [Commands](./commands.md) — Reference for the `/dl`, `/dl-spoiler`, and `/threaddl` slash commands.
- [Development](./development.md) — Local development setup, environment variables, GitHub token scopes, and the Deno test suite.
- [Deployment](./deployment.md) — Deployment workflow, runner image build/publish, and runtime environment.
- [GitHub Actions](./github-actions.md) — `repository_dispatch` payload schemas (`download` and `thread-download`), callback API, status routing (including thread mode), and required secrets.

## See also

- Top-level [README](../README.md) — Project overview, setup, and command list.
- [LICENSE](../LICENSE) — MIT.
