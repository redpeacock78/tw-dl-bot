# Slash Command Reference

All command **definitions** live in `src/bot/commands.ts`; their names come from `Constants.Webhook.Json.ClientPayload.CommandType` in `src/libs/constants.ts`. At runtime, `src/bot/bot.ts` only registers `dl` and `dl-spoiler` as **global** application commands and only dispatches those two in `interactionCreate`. The `threaddl` definition is present but not yet wired up (see [`/threaddl` (in development)](#threaddl-in-development) below).

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

## `/threaddl` (in development)

> **Status:** declared in `src/bot/commands.ts` but not yet wired into the runtime dispatcher in `src/bot/bot.ts`. Implementation is being developed in a separate stream (see task #2). The notes below describe the intended shape; details may change.

Download multiple Tweets into a Discord **thread** named by the user.

| Field | Value |
| --- | --- |
| Name | `threaddl` |
| Description | `DL multiple Tweets into a thread` |
| Type | `1` |

### Options (planned)

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread name to create. |
| `url` | `STRING` (3) | yes | `Tweet URL` | Tweet URL. Space-separated for multiple. |

### Intended behaviour

The bot will create a thread with the given `name` and post each download result inside that thread, in parallel, using the same dispatch / callback pipeline as `/dl`. The `commandType` carried in the dispatch payload will be `threaddl`, and the runner workflow will fan out across the supplied URLs.

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
| `⚠️Error!` embed (immediate) | One or more of the supplied tokens did not parse as a URL. |
| Nothing happens | The bot process is offline, or the `repository_dispatch` POST failed (check `DISPATCH_URL` and `GITHUB_TOKEN`). |
