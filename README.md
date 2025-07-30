# tw-dl-bot

[![DeepWiki](https://img.shields.io/badge/DeepWiki-redpeacock78%2Ftw--dl--bot-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/redpeacock78/tw-dl-bot) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/redpeacock78/tw-dl-bot)  

A **Discord bot for downloading videos from Tweets**.  
Using Slash Commands (like `/dl`), you can send Tweet URLs to the bot, and it will trigger a GitHub Actions workflow to fetch the video and reply with the result directly in Discord.

---

## Features

- **Discord Slash Commands** support
- Download single or multiple Tweet videos
- Live progress updates: progress, success, and failure notifications
- Asynchronous video processing powered by **GitHub Actions**
- Built with **Deno + TypeScript**

---

## Tech Stack

- [Deno](https://deno.land/) + TypeScript
- [discordeno](https://deno.land/x/discordeno)  
- [Hono](https://hono.dev/) for lightweight web routing
- GitHub Actions + Docker for background jobs
- yt-dlp for video downloading

---

## Setup

### 1. Environment Variables

Make sure these environment variables are set:

- `DISCORD_TOKEN` – Discord Bot Token
- `DISPATCH_URL` – `repository_dispatch` endpoint of your GitHub repository
- `GITHUB_TOKEN` – GitHub Personal Access Token (for triggering Actions)

### 2. Run in Development

```bash
deno task dev
````

### 3. Build Executable

```bash
deno task build
```

---

## Slash Commands

* `/dl url:<Tweet URL>`
  Downloads a single Tweet video

---

## Workflow

1. You run a Slash Command on Discord
2. The bot triggers a **repository\_dispatch** event in GitHub Actions
3. A Docker container uses yt-dlp to download the video
4. The result (video or error) is sent back to Discord

---

## Development Helpers

* `deno lint`
  Run code and text linting
* `deno task run`
  Start the bot locally
* `docker/Dockerfile`
  Defines the video processing runner image

---

## License

This project is licensed under the [MIT License](./LICENSE).

