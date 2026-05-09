> English: [../commands.md](../commands.md)

# スラッシュコマンド リファレンス

すべてのコマンド定義は `src/bot/commands.ts` に格納されており、その名前は `src/libs/constants.ts` の `Constants.Webhook.Json.ClientPayload.CommandType` から取得されます。Discord への登録は `src/bot/registerCommands.ts` で行われ、`startBot` の前に `src/main.ts` から一度呼び出されます。4 つのコマンド — `dl`、`dl-spoiler`、`threaddl`、`threaddl-spoiler` — はすべて**グローバル** application command として登録され、`src/bot/bot.ts` の `interactionCreate` handler でディスパッチされます。ディスパッチャーは `interaction.type` で分岐します：

- `ApplicationCommand` → コマンド名で `interactionCreate`（`/dl`、`/dl-spoiler`）または `threadInteractionCreate`（`/threaddl`、`/threaddl-spoiler`）にルーティング。
- `ModalSubmit` → `threadModalSubmit` に渡され、`customId` を検証し、URL を抽出し、共有の `runThreadFlow` を実行。

## `/dl`

1 つ以上のツイート動画をダウンロードしてチャンネルに投稿します。

| Field | Value |
| --- | --- |
| Name | `dl` |
| Description | `Download tweet video` |
| Type | `1` (chat input) |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `url` | `STRING` (3) | yes | `Tweet URL` | ツイート URL。複数の URL はスペースで区切って渡すことができます（Bot が space で分割し、各 token をクライアント側で検証）。 |

### Behaviour

1. Bot は interaction を defer します（`DeferredChannelMessageWithSource`）。
2. `url` 値は space で分割されます。各 token は `isUrl` で検証されます。
3. いずれかの token が URL 検証に失敗した場合、Bot は単一の error embed で応答し、その説明に**すべての**供給された token（改行区切り）をリストします。無効な token だけではなく、そのあと停止します。
4. 各 URL について、Bot は：
   - `🕑Queuing...` follow-up を投稿、
   - `commandType: "dl"` を付けた `download` type の `repository_dispatch` event を火します、
   - その後、follow-up を編集する progress / success / failure callbacks を受け取ります。
5. 成功時、ファイルは success embed にアタッチされます。

### Examples

\`\`\`text
/dl url:https://twitter.com/<user>/status/<id>
/dl url:https://x.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
\`\`\`

## `/dl-spoiler`

`/dl` と同一ですが、結果のファイルは `SPOILER_` prefix でアップロードされ、Discord はそれを spoiler attachment として描画します。

| Field | Value |
| --- | --- |
| Name | `dl-spoiler` |
| Description | `Download tweet video with spoiler` |
| Type | `1` |

### Options

`/dl` と同じ：

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `url` | `STRING` (3) | yes | `Tweet URL` | ツイート URL（複数の場合は space 区切り）。 |

### Behaviour

interaction handler は `/dl` と共有されます（`src/bot/interactionCreate.ts` を参照）。ディスパッチされるペイロードの `commandType`（`dl-spoiler`）のみが異なります。成功時、callback handler はメッセージを構築する際に `spoiler: true` を設定し、これによってファイル名が `SPOILER_` prefix される（`Constants.Message.File.Name.SPOILER_PREFIX`）。

### Example

\`\`\`text
/dl-spoiler url:https://twitter.com/<user>/status/<id>
\`\`\`

## `/threaddl`

複数のツイートを、ユーザーが名前を付けた Discord **thread** にダウンロードします。URL は Discord **Modal** 経由で収集されるため、ユーザーは quote したり escape したりせずに任意の数のリンクを貼り付けることができます。各 URL は専用の GitHub Actions matrix shard で並列処理され、各 shard の結果は thread 内の対応する placeholder message の隣に配置されます。

| Field | Value |
| --- | --- |
| Name | `threaddl` |
| Description | `DL multiple Tweets into a thread` |
| Type | `1` |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread タイトル。Modal `customId` を介して round-trip される前に 80 文字に切り詰められます。同じ切り詰められた値が実際の thread 名として使用されます。 |

> URL は**スラッシュコマンド option ではありません**。スラッシュコマンドへの直接の応答として開く Modal input から読み取られます。

### Modal input

`/threaddl` が呼び出されると、Bot の最初の応答は deferred follow-up ではなく Modal です：

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl|<threadName-truncated-to-80>` |

Modal には単一の Paragraph（複数行） `InputText` component が含まれます：

| InputText field | Value |
| --- | --- |
| `customId` | `urls` |
| `style` | `Paragraph` |
| `label` | `Tweet URLs` |
| `placeholder` | `Paste one URL per line. Spaces / commas are also fine.` |
| `required` | `true` |
| `minLength` | `1` |
| `maxLength` | `4000` |

URL 抽出は delimiter-agnostic です。送信されたテキストは regex **`/https?:\/\/[^\s,;]+/g`** と照合され、whitespace、comma、semicolon で区切られた `http://` または `https://` token をキャプチャします。newline、space、comma、semicolon、またはそれらの任意の組み合わせが separators として機能します。末尾の `,` / `;` は文字クラスが意図的にそれらを除外しているため削除されます。

### Behaviour

1. **ApplicationCommand interaction（スラッシュコマンド）。** `threadInteractionCreate` は `name` option を読み取り、80 文字に切り詰め、**直ちに Modal で応答します**（`InteractionResponseTypes.Modal`）。`customId` は `threaddl|<truncated-threadName>` です。`defer` は送信されません — Modal は interaction への最初の応答である必要があり、deferred ACK は応答スロットを消費してしまいます。
2. **ModalSubmit interaction（ユーザーが Modal を送信）。** `threadModalSubmit` は実行します：
   - **`customId` allowlist。** 最初の `|` は `customId` を `<commandType>` と `<threadName>` に分割します。handler は `commandType` が `Set<string>` allowlist `{ "threaddl", "threaddl-spoiler" }` 内にない限り、interaction を silent に drop します（任意の `customId` prefix を持つ forged ModalSubmit interactions は embed なしに drop されます）。
   - **URL 抽出。** `(ActionRow → InputText)` component tree をウォークして `customId === "urls"` 値を見つけ、その上で `/https?:\/\/[^\s,;]+/g` regex を実行します。URL でない token（および任意の leading or trailing punctuation）は silent に破棄されます。
   - **`runThreadFlow` に引き渡し**。`{ b, interaction (the ModalSubmit one), commandType, threadName, contents }`。
3. **`runThreadFlow`（`/threaddl-spoiler` と共有）。** フロー：
   1. ModalSubmit interaction を defer します（`DeferredChannelMessageWithSource`）。
   2. **Validation gate。** `contents.length > 0`、`every(isUrl)`、`threadName.length > 0` の場合のみ受け入れます。rejection error embed は抽出された token をリストするか、何も抽出されなかった場合は `"No valid URL was found in the input."` を表示します。
   3. **Guild-only guard。** DM 内の Discord interactions は `channelId`（DM channel）を持ちますが、thread は guild text/announcement/forum channel 内でのみ作成できます。`runThreadFlow` は `interaction.guildId` も要求します。これが失われた場合、Bot は `"This command must be used in a guild text channel."` と読む error embed で応答して停止します。
   4. `startThreadWithoutMessage(channelId, { name: threadName, autoArchiveDuration: 1440, type: 11 })` を呼び出します。rejection 時、`Failed to create thread: <reason>` error embed を投稿して停止します。（`1440` 分 = 24 時間自動アーカイブ、`type: 11` = public thread。）
   5. Follow-up を original（Modal） interaction に投稿：`🧵 Created thread <#thread-id> for N URL(s).`
   6. 新しい thread 内で、`sendMessage` で URL ごとに 1 つの `🕑Queuing...` placeholder を投稿します。失敗した `sendMessage` calls は silent に drop されます（`.catch((): null => null)`）。すべての placeholder が失敗した場合（0 件残存）、フロー は何もディスパッチせずに停止します（embed 表示なし — **Send Messages in Threads** が欠けている場合のオペレーター含意については [deployment.md](./deployment.md#bot-permissions-in-discord) を参照）。
   7. **単一の** `repository_dispatch`（`thread-download` type）を火します。`{ commandType: "threaddl" | "threaddl-spoiler", channel: <thread-id>, token, startTime, links: [{ link, message }, ...] }`。dispatch 自体が rejection された場合、すべての placeholder が failure を説明する error embed に編集されます。
4. **Runner。** `.github/workflows/run-thread.yml` は `links` から matrix を構築し、URL ごとに 1 つのジョブを並列で実行します（`max-parallel: 16`、`fail-fast: false`）。各 shard は original `commandType` と `actionType: "thread-single"` または `"thread-multi"` を付けて `/api/callback` に progress、success、failure callbacks を投稿します。
5. **`useThread` short-circuit。** placeholder は thread 内に存在するため（interaction follow-up としてではなく）、すべての callback handler — `progress`、`failure`、および `successMessage.singleFile` / `multiFiles` builders — は `commandType` が `"threaddl"` または `"threaddl-spoiler"`（または `handleSingleSuccess` / `handleMultiSuccess` に渡された `useThread` flag）であるかを確認し、`editFollowupMessage` の代わりに `bot.helpers.editMessage(channelId, messageId, ...)` 経由で placeholder を編集します。このバイパスにより、15 分の interaction-token window は適用されず、non-thread mode では別の message を投稿するようにフォールバックする oversize fallback も short-circuit されるため、message は thread 内に in-place のままになります。

### Example flow（ユーザー視点）

1. ユーザーが `/threaddl name:weekly-faves` を実行。
2. Discord は `Add URLs to "weekly-faves"` というタイトルの Modal を表示し、複数行テキストボックスを表示。
3. ユーザーが URL を貼り付けます（以下のレイアウトはすべて identically parse されます）：

   \`\`\`text
   https://twitter.com/<user>/status/<id1>
   https://x.com/<user>/status/<id2>
   \`\`\`

   \`\`\`text
   https://twitter.com/<user>/status/<id1>, https://x.com/<user>/status/<id2>; https://x.com/<user>/status/<id3>
   \`\`\`

   \`\`\`text
   https://twitter.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
   \`\`\`

4. ユーザーが**Submit**をクリック。
5. Bot は `weekly-faves` thread を作成し、その内部の各 URL ごとに 1 つの `🕑Queuing...` placeholder を投稿し、単一の matrix workflow をディスパッチします。
6. 各 shard が終了すると、その placeholder は success / failure embed に編集されます（成功時はファイルがアタッチされます）。

## `/threaddl-spoiler`

`/threaddl` と同一ですが、成功したすべてのアップロードは `SPOILER_` filename prefix で送信され、Discord はアタッチメントを spoiler として描画します。

| Field | Value |
| --- | --- |
| Name | `threaddl-spoiler` |
| Description | `DL multiple Tweets into a thread with spoiler` |
| Type | `1` |

### Options

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `name` | `STRING` (3) | yes | `Thread Name` | Thread タイトル。`/threaddl` と同じ 80 文字の切り詰め。 |

### Modal input

`/threaddl` と同じ形状ですが、Modal `customId` は `threaddl-spoiler|<threadName>` です。ModalSubmit handler が spoiler path 経由でそれをルーティングできるようにします：

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl-spoiler|<threadName-truncated-to-80>` |

（InputText component 形状は同じです — 上記の `/threaddl` を参照）

### Behaviour

`/threaddl` と同一。両コマンドは `threadInteractionCreate`（Modal を開く）と `threadModalSubmit` → `runThreadFlow`（作業を行う）を共有します。唯一の違いは：

- スラッシュコマンド名（`threaddl-spoiler` vs `threaddl`）、
- `customId`、`repository_dispatch` payload、および各 callback で運ばれる `commandType`（`"threaddl-spoiler"` vs `"threaddl"`）、
- success-callback handlers `success.threadDlSpoiler.{single,multi}` は `spoiler: true` を設定し、これがファイル名が `SPOILER_` prefix される原因です（`Constants.Message.File.Name.SPOILER_PREFIX`）。

`threaddl-spoiler` `commandType` は `threaddl` と同じ `Set` allowlist にあり、同じ `runThreadFlow` が実行され、同じ `run-thread.yml` workflow がディスパッチを処理します（`commandType` は単に callback に渡されます）。

## Command type tokens

dispatch payload と callback で使用される文字列値は一度定義され、Bot、router、workflow を通じて再利用されます：

| Constant | Value |
| --- | --- |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD` | `dl` |
| `Constants.Webhook.Json.ClientPayload.CommandType.DOWNLOAD_SPOILER` | `dl-spoiler` |
| `Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD` | `threaddl` |
| `Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD_SPOILER` | `threaddl-spoiler` |

## Common errors

| Surface | Cause |
| --- | --- |
| `❌Failure!` embed | Runner workflow が `failure` status で終了しました（download timeout、link expired、no video file found、oversized file など）。runner は embed description 経由でどのステップが失敗したかを投稿します。 |
| `⚠️Error!` embed（immediate） | `/dl` / `/dl-spoiler` の場合：供給された token の 1 つ以上が URL として parse できませんでした。`/threaddl` / `/threaddl-spoiler` の場合：regex が URL を抽出しなかった（`"No valid URL was found in the input."`）、抽出された token の少なくとも 1 つが `isUrl` に失敗、`name` option が空、またはコマンドが guild 外で使用されました。 |
| `Failed to create thread: <reason>`（`/threaddl`、`/threaddl-spoiler`） | `startThreadWithoutMessage` が reject されました — 通常、Bot がソース channel で **Create Public Threads** permission を欠落しているか、channel type が thread をサポートしていないため。 |
| Modal が開き、ユーザーが送信すると、その後**interaction が失敗します**（Discord は 3 秒エラータイムアウトを表示）（`/threaddl`、`/threaddl-spoiler`） | unknown `customId` prefix を持つ forged ModalSubmit が allowlist check によって silent に drop されます（handler は ACK なしで早期に返し、Discord が interaction をタイムアウトするままにします）。これは spoofed submissions に対するセキュリティ対策です。通常使用ではこれは発生しません。 |
| Modal が開き、ユーザーが送信し、thread が作成されますが、**thread は空です**（no placeholders、no dispatch）（`/threaddl`、`/threaddl-spoiler`） | Bot がソース channel で **Send Messages in Threads** permission を欠落しています。thread は正常に作成され、`🧵 Created thread` follow-up が投稿されますが、すべての URL ごとの `sendMessage` call が失敗し、placeholder は silent に drop され、フロー は `repository_dispatch` を火さずに返ります。[deployment.md](./deployment.md#bot-permissions-in-discord) を参照。 |
| 何も起こりません | Bot process がオフライン、または `repository_dispatch` POST が失敗しました（`DISPATCH_URL` と `GITHUB_TOKEN` をチェック）。 |
