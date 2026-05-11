> English: [../commands.md](../commands.md)

# スラッシュコマンド リファレンス

すべてのコマンド定義は `src/bot/commands.ts` に格納されています。その名前は `src/libs/constants.ts` の `Constants.Webhook.Json.ClientPayload.CommandType` から取得されます。Discordへの登録は `src/bot/registerCommands.ts` で行われます。`startBot` の前に `src/main.ts` から一度呼び出されます。4つのコマンド — `dl`、`dl-spoiler`、`threaddl`、`threaddl-spoiler` — はすべて**グローバル** application commandとして登録されます。`src/bot/bot.ts` の `interactionCreate` handlerでディスパッチされます。ディスパッチャーは `interaction.type` で分岐します。

- `ApplicationCommand` → コマンド名で振り分けます。`/dl`、`/dl-spoiler` は `interactionCreate` にルーティングします。`/threaddl`、`/threaddl-spoiler` は `threadInteractionCreate` にルーティングします。
- `ModalSubmit` → `threadModalSubmit` に渡され、`customId` を検証し、URLを抽出します。共有の `runThreadFlow` を実行します。

## `/dl`

1つ以上のツイート動画をダウンロードしてチャンネルに投稿します。

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

1. Botはinteractionをdeferします（`DeferredChannelMessageWithSource`）。
2. `url` 値はspaceで分割されます。各tokenは `isUrl` で検証されます。
3. いずれかのtokenがURL検証に失敗した場合、Botは単一のerror embedで応答し、その説明に**すべての**供給されたtoken（改行区切り）をリストします。無効なtokenだけではなく、そのあと停止します。
4. 各URLについて、Botは：
   - `🕑Queuing...` follow-upを投稿、
   - `commandType: "dl"` を付けた `download` typeの `repository_dispatch` eventを火します、
   - その後、follow-upを編集するprogress / success / failure callbacksを受け取ります。
5. 成功時、ファイルはsuccess embedにアタッチされます。

### Examples

```text
/dl url:https://twitter.com/<user>/status/<id>
/dl url:https://x.com/<user>/status/<id1> https://x.com/<user>/status/<id2>
```

## `/dl-spoiler`

`/dl` と同一ですが、結果のファイルは `SPOILER_` prefixでアップロードされ、Discordはそれをspoiler attachmentとして描画します。

| Field | Value |
| --- | --- |
| Name | `dl-spoiler` |
| Description | `Download tweet video with spoiler` |
| Type | `1` |

### Options

`/dl` と同じです。

| Option | Type | Required | Discord description (literal) | Purpose |
| --- | --- | --- | --- | --- |
| `url` | `STRING` (3) | yes | `Tweet URL` | ツイート URL（複数の場合は space 区切り）。 |

### Behaviour

interaction handlerは `/dl` と共有されます（`src/bot/interactionCreate.ts` を参照）。ディスパッチされるペイロードの `commandType`（`dl-spoiler`）のみが異なります。成功時、callback handlerはメッセージを構築する際に `spoiler: true` を設定します。これによりファイル名に `SPOILER_` prefixが付きます（`Constants.Message.File.Name.SPOILER_PREFIX`）。

### Example

```text
/dl-spoiler url:https://twitter.com/<user>/status/<id>
```

## `/threaddl`

複数のツイートを、ユーザーが名前を付けたDiscord **thread** にダウンロードします。URLはDiscord **Modal** 経由で収集されるため、ユーザーはquoteしたりescapeしたりせずに任意の数のリンクを貼り付けることができます。各URLは専用のGitHub Actions matrix shardで並列処理され、各shardの結果はthread内の対応するplaceholder messageの隣に配置されます。

> **Guild 限定コマンド。** このコマンドは `dmPermission: false` で登録され、DM autocomplete に表示されません。Thread 作成は guild text channel 内でのみ可能 — DM での有効なユースケースはありません。stale cached client（~1 時間古い）を持つユーザーが DM からこのコマンドを実行しようとする場合、クライアントはそれをローカルで拒否します。`runThreadFlow` はまた、DM での偶発的な実行を防ぐための防御的な `guildId` チェックも含みます。

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

`/threaddl` が呼び出されると、Botの最初の応答はdeferred follow-upではなくModalです。

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl|<threadName-truncated-to-80>` |

Modalには単一のParagraph（複数行）`InputText` componentが含まれます。

| InputText field | Value |
| --- | --- |
| `customId` | `urls` |
| `style` | `Paragraph` |
| `label` | `Tweet URLs` |
| `placeholder` | `Paste one URL per line. Spaces / commas are also fine.` |
| `required` | `true` |
| `minLength` | `1` |
| `maxLength` | `4000` |

URL抽出はdelimiter-agnosticです。送信されたテキストはregex **`/https?:\/\/[^\s,;]+/g`** と照合されます。whitespace、comma、semicolonで区切られた `http://` や `https://` tokenをキャプチャします。newline、space、comma、semicolon、またはそれらの任意の組み合わせがseparatorsとして機能します。末尾の `,` / `;` は文字クラスが意図的にそれらを除外しているため削除されます。

### Behaviour

1. **ApplicationCommand interaction（スラッシュコマンド）。** `threadInteractionCreate` は `name` optionを読み取り、80文字に切り詰めます。続けて**直ちに Modal で応答します**（`InteractionResponseTypes.Modal`）。`customId` は `threaddl|<truncated-threadName>` です。`defer` は送信されません。Modalはinteractionへの最初の応答である必要があり、deferred ACKは応答スロットを消費してしまうためです。
2. **ModalSubmit interaction（ユーザーが Modal を送信）。** `threadModalSubmit` は以下を実行します。
   - **`customId` allowlist。** 最初の `|` で `customId` を `<commandType>` と `<threadName>` に分割します。`Set<string>` allowlistは `{ "threaddl", "threaddl-spoiler" }` です。handlerは `commandType` がこのallowlist内にない限り、interactionをsilentにdropします。任意の `customId` prefixを持つforged ModalSubmit interactionsはembedなしにdropされます。
   - **URL 抽出。** `(ActionRow → InputText)` component treeをウォークします。`customId === "urls"` 値を見つけ、その上で `/https?:\/\/[^\s,;]+/g` regexを実行します。URLでないtoken（および任意のleading or trailing punctuation）はsilentに破棄されます。
   - **`runThreadFlow` に引き渡し**。`{ b, interaction (the ModalSubmit one), commandType, threadName, contents }`。
3. **`runThreadFlow`（`/threaddl-spoiler` と共有）。** フローは次のとおりです。
   1. ModalSubmit interactionをdeferします（`DeferredChannelMessageWithSource`）。
   2. **Validation gate。** `contents.length > 0`、`every(isUrl)`、`threadName.length > 0` の場合のみ受け入れます。rejection error embedは抽出されたtokenをリストするか、何も抽出されなかった場合は `"No valid URL was found in the input."` を表示します。
   3. **Guild-only guard。** DM内のDiscord interactionsは `channelId`（DM channel）を持ちます。threadはguild text/announcement/forum channel内でのみ作成できます。そのため `runThreadFlow` は `interaction.guildId` も要求します。これが失われた場合、Botは `"This command must be used in a guild text channel."` と読むerror embedで応答して停止します。
   4. `startThreadWithoutMessage` を呼び出します。引数は `(channelId, { name: threadName, autoArchiveDuration: 1440, type: 11 })` です。rejection時、`Failed to create thread: <reason>` error embedを投稿して停止します。`1440` 分は24時間の自動アーカイブを意味し、`type: 11` はpublic threadを表します。
   5. Follow-upをoriginal（Modal）interactionに投稿します。本文は `🧵 Created thread <#thread-id> for N URL(s).` です。
   6. 新しいthread内で、`sendMessage` でURLごとに1つの `🕑Queuing...` placeholderを投稿します。失敗した `sendMessage` callsはsilentにdropされます（`.catch((): null => null)`）。すべてのplaceholderが失敗した場合（0件残存）、フローは何もディスパッチせずに停止します（embed表示なし）。**Send Messages in Threads** が欠けている場合のオペレーター含意については [deployment.md](./deployment.md#bot-permissions-in-discord) を参照してください。
   7. **単一の** `repository_dispatch`（`thread-download` type）を火します。ペイロードのキーは `commandType`、`channel`、`token`、`startTime`、`links` です。各値の型は `commandType: "threaddl" | "threaddl-spoiler"`、`channel: <thread-id>` です。残りは `token`、`startTime`、`links: [{ link, message }, ...]` となります。dispatch自体がrejectionされた場合、すべてのplaceholderがfailureを説明するerror embedに編集されます。
4. **Runner。** `.github/workflows/run-thread.yml` は `links` からmatrixを構築します。URLごとに1つのジョブを並列で実行します（`max-parallel: 16`、`fail-fast: false`）。各shardは付加情報を `/api/callback` にprogress、success、failure callbacksとして投稿します。付加情報はoriginal `commandType` と `actionType: "thread-single"` または `"thread-multi"` です。Discord embedのrun numberは `#N-XX` 形式でフォーマットされます。Nは `github.run_number` を、XXはzero-padded shard index（`01`、`02` など）を表します。これによりどのshardがどのURLを処理したかをidentifyできます。
5. **`useThread` short-circuit。** placeholderはthread内（interaction follow-upとしてではない）に存在します。そのためすべてのcallback handlerは特別なパスを取ります。対象は `progress`、`failure`、および `successMessage.singleFile` / `multiFiles` buildersです。callbackは `commandType` が `"threaddl"` または `"threaddl-spoiler"` であるかを確認します。あるいは `handleSingleSuccess` / `handleMultiSuccess` に渡された `useThread` flagでも判定できます。`editFollowupMessage` の代わりに `bot.helpers.editMessage(channelId, messageId, ...)` 経由でplaceholderを編集します。このバイパスにより15分のinteraction-token windowは適用されません。non-thread modeで別のmessageを投稿するようにフォールバックするoversize fallbackもshort-circuitされます。そのためmessageはthread内にin-placeのままになります。

### Example flow（ユーザー視点）

1. ユーザーが `/threaddl name:weekly-faves` を実行。
2. Discordは `Add URLs to "weekly-faves"` というタイトルのModalを表示し、複数行テキストボックスを表示。
3. ユーザーがURLを貼り付けます（以下のレイアウトはすべてidentically parseされます）：

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

4. ユーザーが**Submit**をクリック。
5. Botは `weekly-faves` threadを作成します。その内部の各URLごとに1つの `🕑Queuing...` placeholderを投稿します。さらに単一のmatrix workflowをディスパッチします。
6. 各shardが終了すると、そのplaceholderはsuccess / failure embedに編集されます（成功時はファイルがアタッチされます）。

## `/threaddl-spoiler`

`/threaddl` と同一ですが、成功したすべてのアップロードは `SPOILER_` filename prefixで送信され、Discordはアタッチメントをspoilerとして描画します。

> **Guild 限定コマンド。** このコマンドは `dmPermission: false` で登録され、DM autocomplete に表示されません。Thread 作成は guild text channel 内でのみ可能 — DM での有効なユースケースはありません。stale cached client（~1 時間古い）を持つユーザーが DM からこのコマンドを実行しようとする場合、クライアントはそれをローカルで拒否します。`runThreadFlow` はまた、DM での偶発的な実行を防ぐための防御的な `guildId` チェックも含みます。

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

`/threaddl` と同じ形状ですが、Modal `customId` は `threaddl-spoiler|<threadName>` です。ModalSubmit handlerがspoiler path経由でそれをルーティングできるようにします。

| Modal field | Value |
| --- | --- |
| `title` | `Add URLs to "<threadName-truncated-to-40>"` |
| `customId` | `threaddl-spoiler|<threadName-truncated-to-80>` |

（InputText component形状は同じです — 上記の `/threaddl` を参照）

### Behaviour

`/threaddl` と同一です。両コマンドは `threadInteractionCreate`（Modalを開く）と `threadModalSubmit` → `runThreadFlow`（作業する処理）を共有します。唯一の違いは以下のとおりです。

- スラッシュコマンド名（`threaddl-spoiler` vs `threaddl`）、
- `customId`、`repository_dispatch` payload、各callbackで運ばれる `commandType`（`"threaddl-spoiler"` vs `"threaddl"`）、
- success-callback handlers `success.threadDlSpoiler.{single,multi}` は `spoiler: true` を設定します。これがファイル名へ `SPOILER_` prefixが付く原因です（`Constants.Message.File.Name.SPOILER_PREFIX`）。

`threaddl-spoiler` の `commandType` は `threaddl` と同じ `Set` allowlistに属します。同じ `runThreadFlow` が実行され、同じ `run-thread.yml` workflowがディスパッチを処理します（`commandType` は単にcallbackへ渡されます）。

## Command type tokens

dispatch payloadとcallbackで使用される文字列値は一度定義され、Bot、router、workflowを通じて再利用されます。

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
| `"This command must be used in a guild text channel."` error（`/threaddl`、`/threaddl-spoiler`） | 通常あり得ません：コマンドは `dmPermission: false` で登録され、DM autocomplete に表示されません。Permission が設定される前に autocomplete にコマンドを持つ cached Discord client（~1 時間古い）を持つユーザーが DM から試行することができます。クライアントはそれを拒否します。拒否が bypass されるか、キャッシュが古いクライアントが permission check をスキップした場合、`runThreadFlow` の防御的な `guildId` チェックもそれを拒否します。 |
