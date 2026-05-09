# GitHub Actions Integration

> 日本語版: [./jp/github-actions.md](./jp/github-actions.md)

The bot offloads all `yt-dlp` work to GitHub Actions. Four workflows are involved:

| Workflow | File | Purpose |
| --- | --- | --- |
| Build runner image | `.github/workflows/build.yml` | Builds and pushes `ghcr.io/<owner>/tw-dl-runner:latest` on `push` to `master` and on a daily schedule. |
| Run download | `.github/workflows/run.yml` | Triggered by a `repository_dispatch` event of type `download`. Runs the runner container against a single URL and posts progress / success / failure callbacks. Used by `/dl` and `/dl-spoiler`. |
| Run thread download | `.github/workflows/run-thread.yml` | Triggered by a `repository_dispatch` event of type `thread-download`. A `prepare` job builds a `strategy.matrix` from the `links` payload, then `run-with-container` fans out one shard per URL (`max-parallel: 16`, `fail-fast: false`). Shared by `/threaddl` and `/threaddl-spoiler` — the workflow does not branch on `commandType`; it just echoes the value back on every callback so the bot's router can pick the spoiler vs. non-spoiler success handler. |
| Test | `.github/workflows/test.yml` | Runs `deno lint`, `deno task test`, and `deno task test:coverage` on every `pull_request` and on `push` to `master`. The coverage report is appended to the GitHub Step Summary. |

## Workflow comparison: `run.yml` vs `run-thread.yml`

|  | `run.yml` | `run-thread.yml` |
| --- | --- | --- |
| Trigger | `repository_dispatch` type `download` | `repository_dispatch` type `thread-download` |
| URLs per dispatch | 1 (`client_payload.link`) | N (`client_payload.links[].link`) |
| Per-URL Discord placeholder | `client_payload.message` (interaction follow-up) | `links[i].message` (regular message inside the thread) |
| Job topology | Single `run-with-container` job | `prepare` job (builds matrix) → `run-with-container` job (`strategy.matrix.include`) |
| Parallelism | 1 | Up to 16 (`max-parallel: 16`, `fail-fast: false`) |
| Success `actionType` | `single` / `multi` | `thread-single` / `thread-multi` |
| Bot-side edit API | `editFollowupMessage` (token-bound, 15-min limit) | `editMessage(channel, message)` (no time limit) |

## Trigger: `repository_dispatch`

The bot uses two distinct dispatch payloads, both posted by the same `ky.post` plumbing in `src/libs/webhook.ts`.

### `event_type: "download"` (`/dl`, `/dl-spoiler`)

```http
POST {DISPATCH_URL}
Authorization: token {GITHUB_TOKEN}
Accept: application/vnd.github.everest-preview+json
Content-Type: application/json

{
  "event_type": "download",
  "client_payload": {
    "commandType": "dl" | "dl-spoiler",
    "link": "https://twitter.com/.../status/...",
    "channel": "<discord channel id, stringified>",
    "message": "<discord follow-up message id, stringified>",
    "token": "<discord interaction token>",
    "startTime": "<unix-ms timestamp, stringified>"
  }
}
```

The bot fires one dispatch per URL when the user passes multiple URLs to `/dl`.

### `event_type: "thread-download"` (`/threaddl`, `/threaddl-spoiler`)

```http
POST {DISPATCH_URL}
Authorization: token {GITHUB_TOKEN}
Accept: application/vnd.github.everest-preview+json
Content-Type: application/json

{
  "event_type": "thread-download",
  "client_payload": {
    "commandType": "threaddl" | "threaddl-spoiler",
    "channel": "<thread channel id, stringified>",
    "token": "<discord interaction token>",
    "startTime": "<unix-ms timestamp, stringified>",
    "links": [
      { "link": "https://twitter.com/.../status/<id1>", "message": "<placeholder message id 1>" },
      { "link": "https://twitter.com/.../status/<id2>", "message": "<placeholder message id 2>" }
    ]
  }
}
```

`channel` here is the **thread** ID returned by `startThreadWithoutMessage`, not the original source channel. Each `links[i].message` is the ID of the placeholder posted inside that thread. The same workflow handles both `commandType` values — `commandType` is just echoed back on every callback so the bot's router can pick the spoiler vs. non-spoiler success handler.

The `interaction.token` carried here is the **ModalSubmit** interaction token (not the original ApplicationCommand token), since `runThreadFlow` runs on the second half of the Modal handshake.

`DISPATCH_URL` is conventionally `https://api.github.com/repos/<owner>/<repo>/dispatches`.

`run.yml` and `run-thread.yml` both consume these fields via `${{ github.event.client_payload.* }}` and mask the user-controlled values with `::add-mask::` to keep them out of the public log. `run-thread.yml` also masks `matrix.link` and `matrix.message` per shard.

## Callback: `POST /api/callback`

The runner posts to the URL in the `ENDPOINT_URL` Actions secret (which should resolve to the bot's public `/api/callback`). Both workflows post to the same endpoint with the same body schema, defined by `CallbackTypes.bodyDataObject` in `src/router/types/callbackTypes.ts`:

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `"success" \| "failure" \| "progress" \| null` | Drives which handler runs. |
| `number` | `string` (per `CallbackTypes.bodyDataObject`) | `${{ github.run_number }}`, displayed in success / failure embeds. The producer is inconsistent: `run.yml` and `run-thread.yml` inject the value unquoted into JSON callbacks (so it arrives as a JSON number) and as a plain `multipart/form-data` field on success (string). The router does not coerce it, so `body.number` may be either at runtime even though the type declares `string`. |
| `commandType` | `"dl" \| "dl-spoiler" \| "threaddl" \| "threaddl-spoiler"` (optional) | Required for `success`; selects the handler family. Also set on **thread-mode** `progress` / `failure` callbacks (so the handlers can detect thread mode and route the spoiler vs. non-spoiler variant), but omitted from `run.yml`'s non-thread `progress` / `failure` callbacks. |
| `actionType` | `"single" \| "multi" \| "thread-single" \| "thread-multi"` (optional) | Required for `success`; selects single-file vs. multi-file handler and thread vs. non-thread routing. Omitted from `progress` / `failure` callbacks. |
| `startTime` | `string` | Echo of the bot-supplied `startTime`; used to compute elapsed time. |
| `channel` | `string` | Discord channel ID (echoed). For `/threaddl` this is the thread ID. |
| `message` | `string` | The Discord message to edit. For `/dl` / `/dl-spoiler` this is the follow-up message ID; for `/threaddl` it is the per-URL placeholder posted inside the thread. |
| `token` | `string` | Discord interaction token (echoed). |
| `link` | `string` | The original Tweet URL (echoed). For `/threaddl`, this is the per-URL `matrix.link`. |
| `shardIndex` | `string` (optional) | Zero-padded matrix shard index (e.g. `"01"`, `"02"`), present only for thread-mode callbacks when the `prepare` job assigns `matrix.index`. Used by the bot to render run numbers as `#N-XX` in Discord embeds (N = `github.run_number`, XX = `shardIndex`). Omitted for `/dl` / `/dl-spoiler` (single-shard) callbacks. |
| `convert` | `"true" \| "false"` (optional) | Whether the runner had to re-encode the file. |
| `oversize` | `"true" \| "false"` (optional) | `"true"` when the resulting file exceeded Discord's upload limit; for non-thread mode the bot then surfaces the file via a fresh `sendMessage`. For thread mode (`useThread`) the bot edits the placeholder in-place anyway. |
| `name1`..`name4`, `file1`..`file4` | `string` / `File` (optional) | File names and `multipart/form-data` parts when uploading 1–4 result files. |
| `size` | `string` (optional) | Total upload size in bytes (used in success embeds). |
| `type` | `string` | Free-form context tag from the runner. |
| `content` | `string` (optional) | Step description shown to the user during `progress` callbacks (e.g. `🛠Setup...`). |

Progress callbacks ship as `application/json`. Success callbacks that include attachments are sent as `multipart/form-data` (the router parses both).

### Status routing

The router uses `Custom.CallbackPattern` (`src/libs/custom.ts`) to pick a handler based on `[status, commandType, actionType]`.

**Routing structure:**

- **Success callbacks** use a union of two disjoint sub-products: (`dl` / `dl-spoiler` × `single` / `multi`) ∪ (`threaddl` / `threaddl-spoiler` × `thread-single` / `thread-multi`) = 4 + 4 = 8 entries, each routed uniquely. The `status` is always `"success"`.
- **Progress and failure callbacks** use a subset-first match: the thread-specific patterns (`commandType === "threaddl"` or `commandType === "threaddl-spoiler"`, `actionType` nullish) must be checked **before** the generic patterns (`commandType` nullish, `actionType` nullish), because both patterns would match a thread-mode callback if the order were reversed. The `actionType` is omitted on progress / failure callbacks from the runner, so matching relies on `status` and `commandType` only.

Thread-mode patterns are listed **before** non-thread patterns in `Custom.CallbackPattern`:

| Pattern | Handler |
| --- | --- |
| `["success", "dl", "single"]` | `success.dl.single` — sends one attached file with a success embed. |
| `["success", "dl", "multi"]` | `success.dl.multi` — sends multiple attached files. |
| `["success", "dl-spoiler", "single"]` | `success.dlSpoiler.single` — same as above, with `SPOILER_` prefix. |
| `["success", "dl-spoiler", "multi"]` | `success.dlSpoiler.multi` — multi-file spoiler. |
| `["success", "threaddl", "thread-single"]` | `success.threadDl.single` — single file edited into the thread placeholder via `editMessage`. |
| `["success", "threaddl", "thread-multi"]` | `success.threadDl.multi` — multiple files edited into the thread placeholder. |
| `["success", "threaddl-spoiler", "thread-single"]` | `success.threadDlSpoiler.single` — single file edited into the thread placeholder, with `SPOILER_` filename prefix. |
| `["success", "threaddl-spoiler", "thread-multi"]` | `success.threadDlSpoiler.multi` — multiple files edited into the thread placeholder, with `SPOILER_` filename prefix. |
| `["progress", "threaddl", <nullish>]` | `progress` (`ProgressThread` triplet) — edits the thread placeholder via `editMessage`. The 15-minute window does not apply. |
| `["progress", "threaddl-spoiler", <nullish>]` | `progress` (`ProgressThreadSpoiler` triplet) — same as above; spoiler-vs-non-spoiler is irrelevant for progress callbacks (no file attached) but the routing is preserved so the per-command pattern stays exhaustive. |
| `["failure", "threaddl", <nullish>]` | `failure` (`FailureThread` triplet) — edits the thread placeholder to a failure embed. |
| `["failure", "threaddl-spoiler", <nullish>]` | `failure` (`FailureThreadSpoiler` triplet) — same handler. |
| `["progress", <nullish>, <nullish>]` | `progress` — edits the existing follow-up message via `editFollowupMessage`, only within the 15-minute edit window. |
| `["failure", <nullish>, <nullish>]` | `failure` — edits the follow-up to a failure embed (within the window) or sends a fresh message (outside it). |
| `[<nullish>, <nullish>, <nullish>]` | `InvalidPost` — body parsed, but `status`, `commandType`, and `actionType` are all missing. Returns `400 Bad Request`. |

Anything else returns `500 Internal Server Error`.

The handler implementation itself is shared: `callbackSuccessFunctions.ts` exports `dl`, `dlSpoiler`, `threadDl`, and `threadDlSpoiler` as thin wrappers around two private helpers, `handleSingleSuccess(infoObject, spoiler, useThread)` and `handleMultiSuccess(infoObject, spoiler, useThread)`. Only the `spoiler` and `useThread` flags differ across the eight entry points (`{single, multi} × {dl, dlSpoiler, threadDl, threadDlSpoiler}`). `useThread === true` causes the message builders in `successMessage.ts` to use `bot.helpers.editMessage(channel, message)` instead of `editFollowupMessage` and to short-circuit the oversize / 15-minute fallback gates.

### Response codes

These are decided by `src/router/callback.ts` after the body is parsed and the `[status, commandType, actionType]` triplet is matched against `Custom.CallbackPattern`:

| Code | When |
| --- | --- |
| `204 No Content` | A handler ran and the Discord API call succeeded. |
| `400 Bad Request` | Body parsed (JSON or multipart), but `status`, `commandType`, and `actionType` are all missing — the `InvalidPost` pattern. |
| `500 Internal Server Error` | Falls through to `.otherwise` — used for body-parse failures and for any other `[status, commandType, actionType]` combination not enumerated above. Discord API errors inside a handler are also reported as `500` by the per-handler `.catch`. |

## Runner processing pipeline

The runner workflows (`run.yml` and `run-thread.yml`) execute inside the Docker container and use shell scripts and composite GitHub Actions to manage the download, encoding, and upload workflow.

### Shell scripts (`.github/scripts/`)

| Script | Purpose |
| --- | --- |
| `progress.awk` | AWK script that parses FFmpeg progress output (`frame=...time=HH:MM:SS...`) and formats it as readable time markers with ETA estimates. Called by the ffmpeg encoding pipeline in the composite action (via `awk -f progress.awk`) to write the progress log file. |
| `retry_curl.sh` | Bash script that wraps `curl` with exponential backoff retry logic. Retries on transient errors (5xx, 429, 408) up to a configurable limit with increasing delays (max 60s). Used for robust callback delivery to the bot's `/api/callback`. |
| `post_process.sh` | Bash script that validates and converts video files to H.264/MP4 format using libx264 single-pass encoding (if needed). Uses FFprobe to check format/codec/pixel format and re-encodes via FFmpeg if not already H.264 + yuv420p. Ensures compatibility with Discord and downstream processing. |
| `conv_progress.sh` | Bash script that monitors a progress log file for changes and sends real-time progress callbacks to the bot. Reads environment variables (`ENDPOINT_URL`, `COMMAND_TYPE`, `SHARD_INDEX`, etc.), watches the log file produced by the ffmpeg/awk pipeline, and POSTs JSON payloads to the callback endpoint. When `SHARD_INDEX` is set (thread mode), it is included in the callback payload so the bot can render run numbers as `#N-XX`; for non-thread runs it is omitted. Runs as a background process during encoding. |

### Composite Action (`.github/actions/check-and-convert-files/`)

**Name:** `Check and Convert Files`

**Purpose:** Validates total download size and re-encodes oversized files to fit within Discord's 10 MB per-attachment limit using two-pass HEVC (H.265) + Opus encoding.

**Inputs:**
- `endpoint_url` — Bot callback URL (for progress updates)
- `run_number` — GitHub Actions run ID
- `start_time` — Workflow start timestamp (used to compute elapsed time)
- `channel` — Discord channel/thread ID
- `message` — Discord message ID (placeholder for in-thread edits, follow-up for `/dl`)
- `token` — Discord interaction token (for edit operations)
- `link` — Original media URL (echoed in callbacks)
- `command_type` — Optional; set only for `/threaddl` / `/threaddl-spoiler` to route callbacks correctly
- `shard_index` — Optional; zero-padded matrix shard index (e.g. `"01"`, `"02"`); passed to `conv_progress.sh` as the `SHARD_INDEX` environment variable so that progress callbacks include the index and the bot can render run numbers as `#N-XX`. Omitted for `/dl` / `/dl-spoiler` (non-thread) runs.

**Workflow:**
1. If total download size ≤ 10 MB, no encoding needed; proceed to upload.
2. If any file is > 10 MB:
   - **Probe step:** Sample 5% of the middle of the file with target encoding settings to estimate overhead and bitrate requirements.
   - **Analyze step** (first pass): Runs HEVC analysis pass to gather statistics for optimal two-pass encoding.
   - **Convert step** (second pass): Encodes using HEVC video (Opus audio) with bitrate calculated to fit within 10 MB and preserve quality. Uses `-fs 10MB` limit as a safety cap.
3. Sends progress callbacks (with phase labels `🔎Probing...`, `🧪Analyzing...`, `🔁Converting...`) throughout the process via `conv_progress.sh`.

**Called by:** Both `run.yml` (for `/dl`, `/dl-spoiler`) and `run-thread.yml` (for `/threaddl`, `/threaddl-spoiler`).

## Secrets

| Where | Name | Purpose |
| --- | --- | --- |
| Bot environment | `DISCORD_TOKEN` | Discord bot token. |
| Bot environment | `DISPATCH_URL` | The `repository_dispatch` URL of the runner repo. Used for both `download` and `thread-download` event types. |
| Bot environment | `GITHUB_TOKEN` | PAT used by the bot to call `DISPATCH_URL`. See [development.md](./development.md#github-token-scopes). |
| GitHub Actions (runner repo) | `ENDPOINT_URL` | Public URL of the bot's `/api/callback`. Used by both `run.yml` and `run-thread.yml` to send progress / success / failure callbacks. |
| GitHub Actions (built-in) | `GITHUB_TOKEN` | Used by `build.yml` to push the runner image to GHCR (`packages: write`). Also used by `run.yml` and `run-thread.yml` to authenticate the GHCR pull when starting the container. Provided by Actions; nothing to configure manually. |

## Runner workflow steps (`run.yml`, single-URL)

`.github/workflows/run.yml` runs entirely inside the prebuilt runner container. The major steps:

1. **Masking Secrets** — masks `commandType`, `link`, `channel`, `message`, `token` with `::add-mask::` so they never appear in logs.
2. **Start Steps / Setup** — posts `progress` callbacks with `⏳Starting...`, `🛠Setup...`, etc., while it ensures `yt-dlp` is on the latest nightly.
3. **Confirmation of link survival** — issues a `GET` (`curl -siL`, headers + follow redirects, body discarded) to the supplied URL to bail out early on dead links.
4. **Start Download** — runs `yt-dlp` with the streaming progress hooks defined in the bash/awk scripts that earlier steps wrote out.
5. **Check and Convert Files** — re-encodes via `ffmpeg` when needed.
6. **Upload files** — sends a `success` callback to `/api/callback` with the resulting file(s) attached as multipart parts (`actionType: single` or `multi`).
7. **Failure paths** — explicit `failure` callbacks for "Link has expired", "Video file not found", "Uploaded file size exceeded", "Download timed out".
8. **Cleanup temp files** — always runs.

## Runner workflow steps (`run-thread.yml`, matrix fan-out)

`.github/workflows/run-thread.yml` runs in two jobs:

### `prepare` job

Builds the strategy matrix from `client_payload.links`:

```bash
matrix="$(jq -c '{include: [.client_payload.links | to_entries[] | {index: ((.key + 1) | tostring | if length < 2 then ("0" + .) else . end), link: .value.link, message: .value.message}]}' "${GITHUB_EVENT_PATH}")"
count="$(jq -r '.client_payload.links | length' "${GITHUB_EVENT_PATH}")"
```

The output is a JSON object of the form `{"include": [{"index": "01", "link": "...", "message": "..."}, {"index": "02", "link": "...", "message": "..."}, ...]}` consumed by the next job's `strategy.matrix`. Each entry includes an `index` field containing a zero-padded 2-digit shard number (01, 02, …) derived from the array position. The shared thread channel ID, `commandType`, `token`, and `startTime` come from the top-level event payload and are read by every shard.

### `run-with-container` job

Runs `if: ${{ fromJson(needs.prepare.outputs.count) > 0 }}` with `strategy.matrix: ${{ fromJson(needs.prepare.outputs.matrix) }}`, `fail-fast: false`, `max-parallel: 16`. The job is named `Download #${{ matrix.index }}` (e.g. `Download #01`, `Download #02`) so that Tweet URLs do not appear in the public GitHub Actions job list; Discord interactions (links, channel IDs) are already masked via `::add-mask::` on the step level, but GitHub's matrix expansion happens before masking can take effect on job names, so the numeric index is used instead as a privacy/security layer.

Each shard receives `matrix.link`, `matrix.message`, and `matrix.index`. Otherwise the steps mirror `run.yml`:

1. **Masking Secrets** — masks `commandType`, `channel`, `token`, `matrix.link`, `matrix.message`.
2. **Start Steps / Setup** — `progress` callbacks include the original `commandType` (`"threaddl"` or `"threaddl-spoiler"`) so the bot routes them through `ProgressThread` / `ProgressThreadSpoiler` and edits the per-shard placeholder via `editMessage`.
3. **Confirmation of link survival → Start Download → Check and Convert Files → Upload files** — identical pipeline, with `actionType=thread-single` or `thread-multi` set on the success callback.
4. **Failure paths** — same explicit `failure` callbacks as `run.yml`, with the original `commandType` echoed back.
5. **Cleanup temp files**.

Because each shard knows its own `matrix.message`, every callback edits the right placeholder inside the thread independently of the other shards. The workflow itself is **commandType-agnostic** — `commandType` is just opaquely passed through; the spoiler-vs-non-spoiler branching happens entirely on the bot side via the success-handler routing table above.

## CI workflow (`test.yml`)

Triggers on every `pull_request` and on `push` to `master`. Steps:

1. `actions/checkout@v6`
2. `denoland/setup-deno@v2` (Deno `v2.x`)
3. `deno lint`
4. `deno task test` (env vars `DISCORD_TOKEN` / `DISPATCH_URL` / `GITHUB_TOKEN` are pre-set to placeholders inside the task definition)
5. `deno task test:coverage | tee coverage.txt`
6. Always: append the contents of `coverage.txt` to the GitHub Step Summary so reviewers see the coverage report directly on the workflow run page.

## When you change the schema

Update every end of the pipeline:

- `src/libs/webhook.ts` (`webhook` and/or `webhookThread` request shape going to GitHub),
- `src/router/types/callbackTypes.ts` (response shape coming back),
- `src/libs/custom.ts` (any new routing pattern),
- `.github/workflows/run.yml` and/or `.github/workflows/run-thread.yml` (the producers of the response),
- and the corresponding rows in this document and `docs/architecture.md`'s status-lifecycle table.
