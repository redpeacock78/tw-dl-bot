# Slash Command Reference

> 日本語版: [./jp/commands.md](./jp/commands.md)

All command definitions live in `src/bot/commands.ts`; their names come from `Constants.Webhook.Json.ClientPayload.CommandType` in `src/libs/constants.ts`. Registration with Discord is performed by `src/bot/registerCommands.ts`, which is invoked once from `src/main.ts` before `startBot`. All four commands — `dl`, `dl-spoiler`, `threaddl`, and `threaddl-spoiler` — are registered as **global** application commands and dispatched in `src/bot/bot.ts`'s `interactionCreate` handler. The dispatcher branches on `interaction.type`:

- `ApplicationCommand` → routed by command name to `interactionCreate` (`/dl`, `/dl-spoiler`) or `threadInteractionCreate` (`/threaddl`, `/threaddl-spoiler`).
- `ModalSubmit` → handed to `threadModalSubmit`, which validates the `customId`, extracts URLs, and runs the shared `runThreadFlow`.

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

Download multiple Tweets into a Discord **thread** named by the user. URLs are collected via a Discord **Modal** so the user can paste an arbitrary number of links without quoting / escaping. Each URL is processed in parallel by a dedicated GitHub Actions matrix shard, and each shard's result lands inside the thread next to the matching placeholder message.

> **Guild-only command.** This command is registered with `dmPermission: false` and is not visible in DM autocomplete. Thread creation requires a guild text channel — there is no valid DM use-case. If a user with a stale cached client (~1 hour) attempts to run this command from a DM, the client will reject it locally; `runThreadFlow` also includes a defensive `guildId` check as a second defense layer for stale cached clients.

| Field | Value |
| --- | --- |
| Name | `threaddl` |
| Description | `DL multiple Tweets into a thread` |
| Type | `1` |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread title. Truncated to 80 characters before being round-tripped via the Modal `customId`; the same truncated value is used as the actual thread name. |

> URLs are **not** a slash-command option. They are read from the Modal input that opens as the immediate response to the slash command.

### Modal input

When `/threaddl` is invoked, the bot's first response is **not** a deferred follow-up but a Modal:

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl|<threadName-truncated-to-80>` |

The Modal contains a single Paragraph (multi-line) `InputText` component:

| InputText field | Value |
| --- | --- |
| `customId` | `urls` |
| `style` | `Paragraph` |
| `label` | `Tweet URLs` |
| `placeholder` | `Paste one URL per line. Spaces / commas are also fine.` |
| `required` | `true` |
| `minLength` | `1` |
| `maxLength` | `4000` |

URL extraction is delimiter-agnostic. The submitted text is matched against the regex **`/https?:\/\/[^\s,;]+/g`**, which captures any `http://` or `https://` token bounded by whitespace, commas, or semicolons. Newlines, spaces, commas, semicolons, or any combination work as separators; trailing `,` / `;` are stripped because the character class deliberately excludes them.

### Behaviour

1. **ApplicationCommand interaction (slash command).** `threadInteractionCreate` reads the `name` option, truncates it to 80 chars, and **immediately responds with a Modal** (`InteractionResponseTypes.Modal`). The `customId` is `threaddl|<truncated-threadName>`. No `defer` is sent — a Modal must be the first response to the interaction, and a deferred ACK would consume the response slot.
2. **ModalSubmit interaction (user submits the Modal).** `threadModalSubmit` runs:
   - **`customId` allowlist.** The first `|` splits the `customId` into `<commandType>` and `<threadName>`. The handler silently drops the interaction unless `commandType` is in the `Set<string>` allowlist `{ "threaddl", "threaddl-spoiler" }` (forged ModalSubmit interactions with arbitrary `customId` prefixes are dropped without an embed).
   - **URL extraction.** Walks the `(ActionRow → InputText)` component tree to find the `customId === "urls"` value, then runs the `/https?:\/\/[^\s,;]+/g` regex over it. Non-URL tokens (and any leading or trailing punctuation) are silently discarded.
   - **Hand off to `runThreadFlow`** with `{ b, interaction (the ModalSubmit one), commandType, threadName, contents }`.
3. **`runThreadFlow` (shared with `/threaddl-spoiler`).** The flow:
   1. Defers the ModalSubmit interaction (`DeferredChannelMessageWithSource`).
   2. **Validation gate.** Rejects unless `contents.length > 0`, `every(isUrl)`, and `threadName.length > 0`. The rejection error embed lists the extracted tokens (or `"No valid URL was found in the input."` when nothing was extracted at all).
   3. **Guild-only guard.** Discord interactions in DMs still carry a `channelId` (the DM channel), but threads can only be created inside a guild text/announcement/forum channel. `runThreadFlow` therefore also requires `interaction.guildId`; if it is missing, the bot replies with an error embed reading `"This command must be used in a guild text channel."` and stops.
   4. Calls `startThreadWithoutMessage(channelId, { name: threadName, autoArchiveDuration: 1440, type: 11 })`. On rejection, posts a `Failed to create thread: <reason>` error embed and stops. (`1440` minutes = 24-hour auto-archive; `type: 11` = public thread.)
   5. Posts a follow-up to the original (Modal) interaction: `🧵 Created thread <#thread-id> for N URL(s).`
   6. Inside the new thread, posts one `🕑Queuing...` placeholder per URL via `sendMessage`. Failed `sendMessage` calls are dropped silently (`.catch((): null => null)`); if every placeholder failed (zero left), the flow stops without dispatching anything (no embed shown — see [deployment.md](./deployment.md#bot-permissions-in-discord) for the operator implication when **Send Messages in Threads** is missing).
   7. Fires **a single** `repository_dispatch` of type `thread-download` carrying `{ commandType: "threaddl" | "threaddl-spoiler", channel: <thread-id>, token, startTime, links: [{ link, message }, ...] }`. If the dispatch itself rejects, every placeholder is edited to an error embed describing the failure.
4. **Runner.** `.github/workflows/run-thread.yml` builds a matrix from `links` and runs one job per URL in parallel (`max-parallel: 16`, `fail-fast: false`). Each shard posts progress, success, and failure callbacks to `/api/callback` with the original `commandType` and `actionType: "thread-single"` or `"thread-multi"`. The Discord embed's run number is formatted as `#N-XX` (N = `github.run_number`, XX = zero-padded shard index like `01`, `02`) to identify which shard processed which URL.
5. **`useThread` short-circuit.** Because the placeholder lives in a thread (not as an interaction follow-up), every callback handler — `progress`, `failure`, and the `successMessage.singleFile` / `multiFiles` builders — checks whether `commandType` is `"threaddl"` or `"threaddl-spoiler"` (or the `useThread` flag passed to `handleSingleSuccess` / `handleMultiSuccess`) and edits the placeholder via `bot.helpers.editMessage(channelId, messageId, ...)` instead of `editFollowupMessage`. This bypass means the 15-minute interaction-token window does not apply, and the oversize fallback that would otherwise post a fresh message in non-thread mode is also short-circuited so the message stays in-place inside the thread.

### Example flow (user perspective)

1. User runs `/threaddl name:weekly-faves`.
2. Discord shows a Modal titled `Add URLs to "weekly-faves"` with a multi-line text box.
3. User pastes URLs (any of the layouts below all parse identically):

   ```text
   https://twitter.com/<user>/status/<id1>
   https://x.com/<user>/status/<id2>
   ```

   ```text
   https://twitter.com/<user>/status/<id1>, https://x.com/<user>/status/<id2>; https://x.com/<user>/status/<id3>
   ```

   ```text
   https://twitter.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
   ```

4. User clicks **Submit**.
5. The bot creates the `weekly-faves` thread, posts one `🕑Queuing...` placeholder per URL inside it, and dispatches a single matrix workflow.
6. As each shard finishes, its placeholder is edited to a success / failure embed (with the file attached on success).

## `/threaddl-spoiler`

Identical to `/threaddl`, except every successful upload is sent with the `SPOILER_` filename prefix so Discord renders the attachment as a spoiler.

> **Guild-only command.** This command is registered with `dmPermission: false` and is not visible in DM autocomplete. Thread creation requires a guild text channel — there is no valid DM use-case. If a user with a stale cached client (~1 hour) attempts to run this command from a DM, the client will reject it locally; `runThreadFlow` also includes a defensive `guildId` check as a second defense layer for stale cached clients.

| Field | Value |
| --- | --- |
| Name | `threaddl-spoiler` |
| Description | `DL multiple Tweets into a thread with spoiler` |
| Type | `1` |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread title. Same 80-character truncation as `/threaddl`. |

### Modal input

Same shape as `/threaddl`, except the Modal `customId` is `threaddl-spoiler|<threadName>` so the ModalSubmit handler can route it through the spoiler path:

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl-spoiler|<threadName-truncated-to-80>` |

(InputText component shape is identical — see `/threaddl` above.)

### Behaviour

Identical to `/threaddl`. Both commands share `threadInteractionCreate` (which opens the Modal) and `threadModalSubmit` → `runThreadFlow` (which does the work). The only differences are:

- the slash-command name (`threaddl-spoiler` vs `threaddl`),
- the `commandType` carried in the `customId`, the `repository_dispatch` payload, and every callback (`"threaddl-spoiler"` vs `"threaddl"`),
- the success-callback handlers `success.threadDlSpoiler.{single,multi}` set `spoiler: true`, which is what causes the file name to be prefixed with `SPOILER_` (`Constants.Message.File.Name.SPOILER_PREFIX`).

The `threaddl-spoiler` `commandType` is in the same `Set` allowlist as `threaddl`, the same `runThreadFlow` runs, and the same `run-thread.yml` workflow handles the dispatch (the `commandType` is just passed through to the callback).

## Command type tokens

The string values used in dispatch payloads and callbacks are defined once and reused across the bot, the router, and the workflow:

| Constant | Value |
| --- | --- |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD` | `dl` |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD_SPOILER` | `dl-spoiler` |
| `Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD` | `threaddl` |
| `Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD_SPOILER` | `threaddl-spoiler` |

## Common errors

| Surface | Cause |
| --- | --- |
| `❌Failure!` embed | The runner workflow finished with the `failure` status (download timeout, link expired, no video file found, oversized file, etc.). The runner posts which step failed via the embed description. |
| `⚠️Error!` embed (immediate) | For `/dl` / `/dl-spoiler`: one or more of the supplied tokens did not parse as a URL. For `/threaddl` / `/threaddl-spoiler`: the regex extracted no URLs (`"No valid URL was found in the input."`), at least one extracted token failed `isUrl`, the `name` option was empty, or the command was used outside a guild. |
| `Failed to create thread: <reason>` (`/threaddl`, `/threaddl-spoiler`) | `startThreadWithoutMessage` rejected — usually because the bot lacks the **Create Public Threads** permission in the source channel, or the channel type does not support threads. |
| Modal opens, user submits, then **interaction fails** (Discord shows 3-sec error timeout) (`/threaddl`, `/threaddl-spoiler`) | A forged ModalSubmit with an unknown `customId` prefix is silently dropped by the allowlist check (the handler returns early with no ACK, leaving Discord to timeout the interaction). This is a security measure against spoofed submissions; under normal use it does not occur. |
| Modal opens, user submits, thread is created, but **thread is empty** (no placeholders, no dispatch) (`/threaddl`, `/threaddl-spoiler`) | The bot lacks the **Send Messages in Threads** permission in the source channel. The thread is successfully created and the `🧵 Created thread` follow-up posts, but every per-URL `sendMessage` call fails, the placeholders are dropped silently, and the flow returns without firing `repository_dispatch`. See [deployment.md](./deployment.md#bot-permissions-in-discord). |
| Nothing happens at all | The bot process is offline, or the `repository_dispatch` POST failed (check `DISPATCH_URL` and `GITHUB_TOKEN`). |
| `"This command must be used in a guild text channel."` error (`/threaddl`, `/threaddl-spoiler`) | Normally impossible: the command is registered with `dmPermission: false` and is not visible in DM autocomplete. If a user with a cached Discord client (~1 hour stale) has the command in their autocomplete from before the permission was set, they can attempt it from a DM. The client will reject it; if the rejection is bypassed or a stale cached client somehow bypasses the check, `runThreadFlow`'s defensive `guildId` check will also reject it. |
