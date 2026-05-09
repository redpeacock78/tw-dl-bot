# Slash Command Reference

All command definitions live in `src/bot/commands.ts`; their names come from `Constants.Webhook.Json.ClientPayload.CommandType` in `src/libs/constants.ts`. Registration with Discord is performed by `src/bot/registerCommands.ts`, which is invoked once from `src/main.ts` before `startBot`. All three commands — `dl`, `dl-spoiler`, and `threaddl` — are registered as **global** application commands and dispatched by name in `src/bot/bot.ts`'s `interactionCreate` handler.

## `/dl`

Download one or more Tweet videos and post them to the channel.

| Field | Value |
| --- | --- |
| Name | `dl` |
| Description | `Download tweet video` |
| Type | `1` (chat input) |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `url` | `STRING` (3) | yes | `Tweet URL` | Tweet URL. Multiple URLs may be passed by separating them with a single space (the bot splits on space and validates each token client-side). |

### Behaviour

1. The bot defers the interaction (`DeferredChannelMessageWithSource`).
2. The `url` value is split on spaces. Each token is validated with `isUrl`.
3. If any token fails URL validation, the bot replies with a single error embed whose description lists **all** supplied tokens (newline-separated), not only the invalid ones, and then stops.
4. For each URL, the bot:
   - posts a `🕑Queuing...` follow-up,
   - fires a `repository_dispatch` event of type `download` with `commandType: "dl"`,
   - and then receives progress / success / failure callbacks that edit the follow-up.
5. On success, the file is attached to the success embed.

### Examples

```text
/dl url:https://twitter.com/<user>/status/<id>
/dl url:https://x.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
```

## `/dl-spoiler`

Identical to `/dl`, except the resulting file is uploaded with the `SPOILER_` prefix so Discord renders it as a spoiler attachment.

| Field | Value |
| --- | --- |
| Name | `dl-spoiler` |
| Description | `Download tweet video with spoiler` |
| Type | `1` |

### Options

Same as `/dl`:

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `url` | `STRING` (3) | yes | `Tweet URL` | Tweet URL (space-separated for multiple). |

### Behaviour

The interaction handler is shared with `/dl` (see `src/bot/interactionCreate.ts`); only the `commandType` (`dl-spoiler`) differs in the dispatched payload. On success, the callback handler sets `spoiler: true` when building the message, which causes the file name to be prefixed with `SPOILER_` (`Constants.Message.File.Name.SPOILER_PREFIX`).

### Example

```text
/dl-spoiler url:https://twitter.com/<user>/status/<id>
```

## `/threaddl`

Download multiple Tweets into a Discord **thread** named by the user. Each URL is processed in parallel by a dedicated GitHub Actions matrix shard, and each shard's result lands inside the thread next to the matching placeholder message.

| Field | Value |
| --- | --- |
| Name | `threaddl` |
| Description | `DL multiple Tweets into a thread` |
| Type | `1` |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread name to create. |
| `url` | `STRING` (3) | yes | `Tweet URL` | Tweet URL. Multiple URLs may be passed by separating them with a single space (the bot splits on space, drops empty tokens, and validates each remaining token client-side). |

> **Note (forward-looking):** task #6 is exploring a Modal-based UI for `/threaddl` so the user can paste multiple URLs into a multi-line text input instead of a single space-separated string. Until that lands, the surface above is the current spec.

### Behaviour

1. The bot defers the interaction (`DeferredChannelMessageWithSource`).
2. The `name` and `url` options are read from the interaction. `url` is split on spaces (empty tokens dropped); the request is rejected unless `name` is non-empty, every URL token passes `isUrl`, and at least one URL was supplied. The rejection error embed lists the supplied tokens (or the raw input if the split produced none).
3. **Guild-only guard.** Discord interactions in DMs still carry a `channelId` (the DM channel), but threads can only be created inside a guild text/announcement/forum channel. `threadInteractionCreate` therefore also requires `interaction.guildId`; if it is missing, the bot replies with an error embed reading "This command must be used in a guild text channel." and stops.
4. The bot calls `startThreadWithoutMessage(channelId, { name, autoArchiveDuration: 1440, type: 11 })` to create a public thread. If the call fails, the bot replies with a `Failed to create thread: <reason>` error embed and stops. (`1440` minutes = 24-hour auto-archive; `type: 11` = public thread.)
5. The bot posts a follow-up to the original interaction announcing the thread (`🧵 Created thread <#thread-id> for N URL(s).`).
6. Inside the new thread, the bot posts one `🕑Queuing...` placeholder per URL via `sendMessage`. Failed `sendMessage` calls are dropped silently. If every placeholder failed (zero left), the bot stops.
7. The bot fires **a single** `repository_dispatch` of type `thread-download` carrying `{ commandType: "threaddl", channel: <thread-id>, token, startTime, links: [{ link, message }, ...] }`. If the dispatch itself rejects, every placeholder is edited to an error embed describing the failure.
8. The runner workflow (`.github/workflows/run-thread.yml`) builds a matrix from `links` and runs one job per URL in parallel (`max-parallel: 16`, `fail-fast: false`). Each shard posts progress, success, and failure callbacks to `/api/callback` with `commandType: "threaddl"` and `actionType: "thread-single"` or `"thread-multi"`.
9. **`useThread` short-circuit.** Because the placeholder lives in a thread (not as an interaction follow-up), every callback handler — `progress`, `failure`, and the `successMessage.singleFile` / `multiFiles` builders — checks `commandType === "threaddl"` (or the `useThread` flag) and edits the placeholder via `bot.helpers.editMessage(channelId, messageId, ...)` instead of `editFollowupMessage`. This bypass means the 15-minute interaction-token window does not apply, and the oversize fallback that would otherwise post a fresh message in non-thread mode is also short-circuited so the message stays in-place inside the thread.

### Example

```text
/threaddl name:my-thread url:https://twitter.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
```

## Command type tokens

The string values used in dispatch payloads and callbacks are defined once and reused across the bot, the router, and the workflow:

| Constant | Value |
| --- | --- |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD` | `dl` |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD_SPOILER` | `dl-spoiler` |
| `Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD` | `threaddl` |

## Common errors

| Surface | Cause |
| --- | --- |
| `❌Failure!` embed | The runner workflow finished with the `failure` status (download timeout, link expired, no video file found, oversized file, etc.). The runner posts which step failed via the embed description. |
| `⚠️Error!` embed (immediate) | For `/dl` / `/dl-spoiler`: one or more of the supplied tokens did not parse as a URL. For `/threaddl`: same, plus an empty `name`, an empty `url`, or use outside a guild. |
| `Failed to create thread: <reason>` (`/threaddl` only) | `startThreadWithoutMessage` rejected — usually because the bot lacks the **Create Public Threads** permission in the source channel, or the channel type does not support threads. |
| Nothing happens | The bot process is offline, or the `repository_dispatch` POST failed (check `DISPATCH_URL` and `GITHUB_TOKEN`). |
