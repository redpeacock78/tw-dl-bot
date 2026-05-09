# GitHub Actions Integration

The bot offloads all `yt-dlp` work to GitHub Actions. Two workflows are involved:

| Workflow | File | Purpose |
| --- | --- | --- |
| Build runner image | `.github/workflows/build.yml` | Builds and pushes `ghcr.io/<owner>/tw-dl-runner:latest` on `push` to `master` and on a daily schedule. |
| Run download | `.github/workflows/run.yml` | Triggered by a `repository_dispatch` event of type `download`. Runs the runner container and posts progress / success / failure callbacks. |

## Trigger: `repository_dispatch`

The bot calls `POST {DISPATCH_URL}` (see `src/libs/webhook.ts`) with the standard GitHub repository_dispatch shape:

```http
POST {DISPATCH_URL}
Authorization: token {GITHUB_TOKEN}
Accept: application/vnd.github.everest-preview+json
Content-Type: application/json

{
  "event_type": "download",
  "client_payload": {
    "commandType": "dl" | "dl-spoiler" | "threaddl",
    "link": "https://twitter.com/.../status/...",
    "channel": "<discord channel id, stringified>",
    "message": "<discord follow-up message id, stringified>",
    "token": "<discord interaction token>",
    "startTime": "<unix-ms timestamp, stringified>"
  }
}
```

`DISPATCH_URL` is conventionally `https://api.github.com/repos/<owner>/<repo>/dispatches`.

`run.yml` consumes these fields via `${{ github.event.client_payload.* }}`, masks the user-controlled values with `::add-mask::` to keep them out of the public log, and passes them on to each callback.

## Callback: `POST /api/callback`

The runner posts to the URL in the `ENDPOINT_URL` Actions secret (which should resolve to the bot's public `/api/callback`). The shape is defined by `CallbackTypes.bodyDataObject` in `src/router/types/callbackTypes.ts`:

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `"success" \| "failure" \| "progress" \| null` | Drives which handler runs. |
| `number` | `string` (per `CallbackTypes.bodyDataObject`) | `${{ github.run_number }}`, displayed in success / failure embeds. The producer is inconsistent: `run.yml` injects the value unquoted into JSON callbacks (so it arrives as a JSON number) and as a plain `multipart/form-data` field on success (string). The router does not coerce it, so `body.number` may be either at runtime even though the type declares `string`. |
| `commandType` | `"dl" \| "dl-spoiler"` (optional) | Required for `success`; selects single vs. spoiler handler. |
| `actionType` | `"single" \| "multi"` (optional) | Required for `success`; selects single-file vs. multi-file handler. |
| `startTime` | `string` | Echo of the bot-supplied `startTime`; used to compute elapsed time. |
| `channel` | `string` | Discord channel ID (echoed). |
| `message` | `string` | Discord follow-up message ID (echoed). |
| `token` | `string` | Discord interaction token (echoed). |
| `link` | `string` | The original Tweet URL (echoed). |
| `convert` | `"true" \| "false"` (optional) | Whether the runner had to re-encode the file. |
| `oversize` | `"true" \| "false"` (optional) | `"true"` when the resulting file exceeded Discord's upload limit; the bot then surfaces the file via a different path. |
| `name1`..`name4`, `file1`..`file4` | `string` / `File` (optional) | File names and `multipart/form-data` parts when uploading 1–4 result files. |
| `size` | `string` (optional) | Total upload size in bytes (used in success embeds). |
| `type` | `string` | Free-form context tag from the runner. |
| `content` | `string` (optional) | Step description shown to the user during `progress` callbacks (e.g. `🛠Setup...`). |

Progress callbacks ship as `application/json`. Success callbacks that include attachments are sent as `multipart/form-data` (the router parses both).

### Status routing

The router uses `Custom.CallbackPattern` (`src/libs/custom.ts`) to pick a handler based on `[status, commandType, actionType]`:

| Pattern | Handler |
| --- | --- |
| `["success", "dl", "single"]` | `success.dl.single` — sends one attached file with a success embed. |
| `["success", "dl", "multi"]` | `success.dl.multi` — sends multiple attached files. |
| `["success", "dl-spoiler", "single"]` | `success.dlSpoiler.single` — same as above, with `SPOILER_` prefix. |
| `["success", "dl-spoiler", "multi"]` | `success.dlSpoiler.multi` — multi-file spoiler. |
| `["progress", <nullish>, <nullish>]` | `progress` — edits the existing follow-up message (within the 15-minute edit window). The `commandType` and `actionType` fields are omitted by `run.yml` for progress callbacks, so the matcher uses `P.nullish`. |
| `["failure", <nullish>, <nullish>]` | `failure` — replies with a failure embed. Same `P.nullish` matching as `progress`. |
| `[<nullish>, <nullish>, <nullish>]` | `InvalidPost` — body parsed, but `status`, `commandType`, and `actionType` are all missing. Returns `400 Bad Request`. |

Anything else returns `500 Internal Server Error`.

### Response codes

These are decided by `src/router/callback.ts` after the body is parsed and the `[status, commandType, actionType]` triplet is matched against `Custom.CallbackPattern`:

| Code | When |
| --- | --- |
| `204 No Content` | A handler ran and the Discord API call succeeded. |
| `400 Bad Request` | Body parsed (JSON or multipart), but `status`, `commandType`, and `actionType` are all missing — the `InvalidPost` pattern. |
| `500 Internal Server Error` | Falls through to `.otherwise` — used for body-parse failures and for any other `[status, commandType, actionType]` combination not enumerated above. Discord API errors inside a handler are also reported as `500` by the per-handler `.catch`. |

## Secrets

| Where | Name | Purpose |
| --- | --- | --- |
| Bot environment | `DISCORD_TOKEN` | Discord bot token. |
| Bot environment | `DISPATCH_URL` | The `repository_dispatch` URL of the runner repo. |
| Bot environment | `GITHUB_TOKEN` | PAT used by the bot to call `DISPATCH_URL`. See [development.md](./development.md#github-token-scopes). |
| GitHub Actions (runner repo) | `ENDPOINT_URL` | Public URL of the bot's `/api/callback`. Used by `run.yml` to send progress / success / failure callbacks. |
| GitHub Actions (built-in) | `GITHUB_TOKEN` | Used by `build.yml` to push the runner image to GHCR (`packages: write`). Provided by Actions; nothing to configure manually. |

## Runner workflow steps (high level)

`.github/workflows/run.yml` runs entirely inside the prebuilt runner container. The major steps:

1. **Masking Secrets** — masks `commandType`, `link`, `channel`, `message`, `token` with `::add-mask::` so they never appear in logs.
2. **Start Steps / Setup** — posts `progress` callbacks with `⏳Starting...`, `🛠Setup...`, etc., while it ensures `yt-dlp` is on the latest nightly.
3. **Confirmation of link survival** — issues a `GET` (`curl -siL`, headers + follow redirects, body discarded) to the supplied URL to bail out early on dead links.
4. **Start Download** — runs `yt-dlp` with the streaming progress hooks defined in the bash/awk scripts that earlier steps wrote out.
5. **Check and Convert Files** — re-encodes via `ffmpeg` when needed.
6. **Upload files** — sends a `success` callback to `/api/callback` with the resulting file(s) attached as multipart parts.
7. **Failure paths** — explicit `failure` callbacks for "Link has expired", "Video file not found", "Uploaded file size exceeded", "Download timed out".
8. **Cleanup temp files** — always runs.

If you change the schema, update both ends:

- `src/libs/webhook.ts` (request shape going to GitHub),
- `src/router/types/callbackTypes.ts` (response shape coming back),
- `.github/workflows/run.yml` (the producer of the response).
