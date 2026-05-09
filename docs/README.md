# tw-dl-bot Documentation

This directory contains the developer-facing documentation for **tw-dl-bot**, a Deno + TypeScript Discord bot that downloads videos from Tweets via yt-dlp running in GitHub Actions.

## Contents

- [Architecture](./architecture.md) — High-level system overview and data flow between Discord, the bot, GitHub Actions, and yt-dlp.
- [Commands](./commands.md) — Reference for the `/dl`, `/dl-spoiler`, and `/threaddl` slash commands.
- [Development](./development.md) — Local development setup, environment variables, and required GitHub token scopes.
- [Deployment](./deployment.md) — Deployment workflow, runner image build/publish, and runtime environment.
- [GitHub Actions](./github-actions.md) — `repository_dispatch` payload schema, callback API, and required secrets.

## See also

- Top-level [README](../README.md) — Project overview, setup, and command list.
- [LICENSE](../LICENSE) — MIT.
