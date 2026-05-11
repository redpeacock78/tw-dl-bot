> English: [../github-actions.md](../github-actions.md)

# GitHub Actions Integration

Botはすべての `yt-dlp` 作業をGitHub Actionsにオフロード。4つのワークフローが関係：

| Workflow | File | Purpose |
| --- | --- | --- |
| Build runner image | `.github/workflows/build.yml` | `ghcr.io/<owner>/tw-dl-runner:latest` をビルドしてプッシュ。`master` への `push` 時および daily schedule。 |
| Run download | `.github/workflows/run.yml` | `repository_dispatch` event of type `download` によってトリガー。runner container を単一 URL に対して実行し、progress / success / failure callbacks を投稿。`/dl` と `/dl-spoiler` で使用。 |
| Run thread download | `.github/workflows/run-thread.yml` | `repository_dispatch` event of type `thread-download` によってトリガー。`prepare` job が `links` payload から `strategy.matrix` を構築し、`run-with-container` が URL ごとに 1 つの shard をファンアウト（`max-parallel: 16`、`fail-fast: false`）。`/threaddl` と `/threaddl-spoiler` で共有 — workflow は `commandType` で分岐しません。値を callback に echo back し、Bot の router が spoiler vs. non-spoiler success handler をピック。 |
| Test | `.github/workflows/test.yml` | `pull_request` および `master` への `push` のたびに `deno lint`、`deno task test`、`deno task test:coverage` を実行。coverage report は GitHub Step Summary に追加。 |

## Workflow comparison: `run.yml` vs `run-thread.yml`

|  | `run.yml` | `run-thread.yml` |
| --- | --- | --- |
| Trigger | `repository_dispatch` type `download` | `repository_dispatch` type `thread-download` |
| URLs per dispatch | 1（`client_payload.link`） | N（`client_payload.links[].link`） |
| Per-URL Discord placeholder | `client_payload.message`（interaction follow-up） | `links[i].message`（thread 内の regular message） |
| Job topology | Single `run-with-container` job | `prepare` job（matrix を構築） → `run-with-container` job（`strategy.matrix.include`） |
| Parallelism | 1 | Up to 16（`max-parallel: 16`、`fail-fast: false`） |
| Success `actionType` | `single` / `multi` | `thread-single` / `thread-multi` |
| Bot-side edit API | `editFollowupMessage`（token-bound、15 分 limit） | `editMessage(channel, message)`（time limit なし） |

## Trigger: `repository_dispatch`

Botは同じ `ky.post` plumbing in `src/libs/webhook.ts` で2つのdistinct dispatch payloadsを使用。

### `event_type: "download"`（`/dl`、`/dl-spoiler`）

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

Botはユーザーが複数のURLを `/dl` に渡す場合、URLごとに1つのディスパッチを火します。

### `event_type: "thread-download"`（`/threaddl`、`/threaddl-spoiler`）

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

`channel` ここは **thread** ID。`startThreadWithoutMessage` によって返された、original source channelではなく。各 `links[i].message` はthread内に投稿されたplaceholderのID。同じworkflowが両方の `commandType` valuesを処理 — `commandType` はcallbackごとにecho backされ、Botのrouterがspoiler vs. non-spoiler success handlerをピックするために使用。

interaction.tokenここは **ModalSubmit** interaction token（original ApplicationCommand tokenではなく）。`runThreadFlow` はModal handshakeの2番目のハーフで実行するため。

`DISPATCH_URL` はconventionally `https://api.github.com/repos/<owner>/<repo>/dispatches`。

`run.yml` と `run-thread.yml` の両方は `${{ github.event.client_payload.* }}` 経由でこれらのフィールドをconsumeし、user-controlled valuesを `::add-mask::` でマスク。public logの外に。`run-thread.yml` はshardごとに `matrix.link` と `matrix.message` もmask。

## Callback: `POST /api/callback`

runnerは `ENDPOINT_URL` Actions secretのURLに投稿（Botのpublic `/api/callback` にresolveされる）。両方のワークフローは同じendpointに同じbody schemaで投稿。`CallbackTypes.bodyDataObject` in `src/router/types/callbackTypes.ts` で定義：

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `"success" \| "failure" \| "progress" \| null` | どの handler を実行するかを drive。 |
| `number` | `string`（per `CallbackTypes.bodyDataObject`） | `${{ github.run_number }}`。success / failure embeds で display。producer は inconsistent：`run.yml` と `run-thread.yml` は value を JSON callbacks に unquoted で inject（JSON number として arrive）し、success で plain `multipart/form-data` field（string）として。router は coerce しないため、runtime で `body.number` は either である可能性あり。type が `string` を declare していても。 |
| `commandType` | `"dl" \| "dl-spoiler" \| "threaddl" \| "threaddl-spoiler"`（optional） | `success` には必須。handler family をセレクト。また **thread-mode** `progress` / `failure` callbacks で設定（handlers が thread mode を detect し、spoiler vs. non-spoiler variant をルーティングできるように）。但し `run.yml` の non-thread `progress` / `failure` callbacks からは省略。 |
| `actionType` | `"single" \| "multi" \| "thread-single" \| "thread-multi"`（optional） | `success` には必須。single-file vs. multi-file handler と thread vs. non-thread routing をセレクト。`progress` / `failure` callbacks からは省略。 |
| `startTime` | `string` | Bot-supplied `startTime` の echo。elapsed time を compute するために使用。 |
| `channel` | `string` | Discord channel ID（echoed）。`/threaddl` の場合はこれは thread ID。 |
| `message` | `string` | 編集する Discord message。`/dl` / `/dl-spoiler` の場合はこれは follow-up message ID。`/threaddl` の場合は thread 内に投稿された per-URL placeholder。 |
| `token` | `string` | Discord interaction token（echoed）。 |
| `link` | `string` | original Tweet URL（echoed）。`/threaddl` の場合、これは per-URL `matrix.link`。 |
| `shardIndex` | `string`（optional） | zero-padded matrix shard index（例：`"01"`、`"02"`）。thread-mode callbacks でのみ存在。`prepare` job が `matrix.index` を assign するときに present。Bot が Discord embeds で run numbers を `#N-XX` 形式でレンダリング（N = `github.run_number`、XX = `shardIndex`）するために使用。`/dl` / `/dl-spoiler`（single-shard）callbacks からは省略。 |
| `convert` | `"true" \| "false"`（optional） | runner がファイルを re-encode する必要があったかどうか。 |
| `oversize` | `"true" \| "false"`（optional） | `"true"` when 結果のファイルが Discord のアップロード limit を exceeded。non-thread mode の場合、Bot は fresh `sendMessage` 経由でファイルを surface。thread mode（`useThread`）の場合、Bot は placeholder を in-place で編集。 |
| `name1`..`name4`、`file1`..`file4` | `string` / `File`（optional） | 1 から 4 つの結果ファイルをアップロード時のファイル名と `multipart/form-data` parts。 |
| `size` | `string`（optional） | Total upload size in bytes（success embeds で使用）。 |
| `type` | `string` | runner からの free-form context tag。 |
| `content` | `string`（optional） | `progress` callbacks 中に user に表示される step 説明。例えば `🛠Setup...`。 |

Progress callbacksは `application/json` としてship。Success callbacks with attachmentsは `multipart/form-data` で送信（routerは両方をparse）。

### Status routing

routerは `Custom.CallbackPattern`（`src/libs/custom.ts`）を使用して `[status, commandType, actionType]` に基づいてhandlerをピック。

**Routing structure:**

- **Success callbacks** use a union of two disjoint sub-products: (`dl` / `dl-spoiler` × `single` / `multi`) ∪ (`threaddl` / `threaddl-spoiler` × `thread-single` / `thread-multi`) = 4 + 4 = 8 entries。各々がuniquely routed。`status` は常に `"success"`。
- **Progress and failure callbacks** use a subset-first match: thread-specific patterns（`commandType === "threaddl"` または `commandType === "threaddl-spoiler"`、`actionType` nullish）はgeneric patterns（`commandType` nullish、`actionType` nullish）**の前に** checkedされる必要があります。なぜならorderが反対なら両方のパターンがthread-mode callbackにマッチ。`actionType` はrunnerからのprogress / failure callbacksで省略されるため、matchingは `status` と `commandType` のみに依存。

Thread-mode patternsは `Custom.CallbackPattern` でnon-thread patternsの **前に** list：

| Pattern | Handler |
| --- | --- |
| `["success", "dl", "single"]` | `success.dl.single` — success embed を付けて 1 つのアタッチメントを送信。 |
| `["success", "dl", "multi"]` | `success.dl.multi` — multiple attached files。 |
| `["success", "dl-spoiler", "single"]` | `success.dlSpoiler.single` — 上記と同じ、`SPOILER_` prefix 付き。 |
| `["success", "dl-spoiler", "multi"]` | `success.dlSpoiler.multi` — multi-file spoiler。 |
| `["success", "threaddl", "thread-single"]` | `success.threadDl.single` — thread placeholder に `editMessage` で編集される単一ファイル。 |
| `["success", "threaddl", "thread-multi"]` | `success.threadDl.multi` — thread placeholder に編集される複数ファイル。 |
| `["success", "threaddl-spoiler", "thread-single"]` | `success.threadDlSpoiler.single` — thread placeholder に編集される単一ファイル、`SPOILER_` filename prefix 付き。 |
| `["success", "threaddl-spoiler", "thread-multi"]` | `success.threadDlSpoiler.multi` — thread placeholder に編集される複数ファイル、`SPOILER_` filename prefix 付き。 |
| `["progress", "threaddl", <nullish>]` | `progress`（`ProgressThread` triplet） — thread placeholder を `editMessage` で編集。15 分 window は適用されない。 |
| `["progress", "threaddl-spoiler", <nullish>]` | `progress`（`ProgressThreadSpoiler` triplet） — 上記と同じ。spoiler vs. non-spoiler は progress callbacks では無関係（file がアタッチされない）。但し routing は preserved して、per-command pattern は exhaustive のまま。 |
| `["failure", "threaddl", <nullish>]` | `failure`（`FailureThread` triplet） — thread placeholder を failure embed に編集。 |
| `["failure", "threaddl-spoiler", <nullish>]` | `failure`（`FailureThreadSpoiler` triplet） — 同じ handler。 |
| `["progress", <nullish>, <nullish>]` | `progress` — `editFollowupMessage` 経由で existing follow-up message を編集。15 分 edit window 内のみ。 |
| `["failure", <nullish>, <nullish>]` | `failure` — failure embed に follow-up を編集（window 内）。または fresh message を送信（outside）。 |
| `[<nullish>, <nullish>, <nullish>]` | `InvalidPost` — body parsed。但し `status`、`commandType`、`actionType` はすべて missing。`400 Bad Request` を返す。 |

その他はすべて `500 Internal Server Error` を返す。

handler implementation自体はshared：`callbackSuccessFunctions.ts` は `dl`、`dlSpoiler`、`threadDl`、`threadDlSpoiler` を2つのprivate helpersの周りのthin wrappersとしてエクスポート。`handleSingleSuccess(infoObject, spoiler, useThread)` と `handleMultiSuccess(infoObject, spoiler, useThread)`。`spoiler` と `useThread` flagsのみが8つのentry points（`{single, multi} × {dl, dlSpoiler, threadDl, threadDlSpoiler`）で異なります。`useThread === true` はmessage builders in `successMessage.ts` を `editFollowupMessage` の代わりに `bot.helpers.editMessage(channel, message)` を使用させ、oversize / 15分fallback gatesをshort-circuit。

### Response codes

bodyはparseされ、`[status, commandType, actionType]` tripletは `Custom.CallbackPattern` に対してmatchedされた後に `src/router/callback.ts` で決定：

| Code | When |
| --- | --- |
| `204 No Content` | handler が ran、Discord API call に成功。 |
| `400 Bad Request` | body は parsed（JSON または multipart）。但し `status`、`commandType`、`actionType` はすべて missing — `InvalidPost` pattern。 |
| `500 Internal Server Error` | `.otherwise` にフォールスルー — body-parse failures と `Custom.CallbackPattern` に列挙されない `[status, commandType, actionType]` combination に使用。handler 内の Discord API errors も handler の `.catch` によって `500` としてレポート。 |

## Runner processing pipeline

Runner workflows（`run.yml` と `run-thread.yml`）はDocker container内で実行され、shell scriptsとcomposite GitHub Actionsを使用してdownload、encoding、upload workflowを管理。

### Shell scripts（`.github/scripts/`）

| Script | Purpose |
| --- | --- |
| `progress.awk` | AWK script。FFmpeg progress output（`frame=...time=HH:MM:SS...`）をパースし、ETA estimates 付きで readable time markers としてフォーマット。Composite action の ffmpeg encoding pipeline によって（`awk -f progress.awk` 経由で）呼び出され、progress log file に書き込み。 |
| `retry_curl.sh` | Bash script。`curl` を exponential backoff retry logic でラップ。Transient errors（5xx、429、408）に対して configurable limit（最大遅延 60s）までリトライ。Bot の `/api/callback` への robust callback delivery に使用。 |
| `post_process.sh` | Bash script。Video ファイルを validate し、必要に応じて libx264 single-pass encoding を使用して H.264/MP4 format に変換。FFprobe を使用して format/codec/pixel format をチェックし、まだ H.264 + yuv420p でない場合は FFmpeg 経由で re-encode。Discord と downstream processing との互換性を ensure。 |
| `conv_progress.sh` | Bash script。Progress log file の変更を監視し、Bot へ real-time progress callbacks を送信。Environment variables（`ENDPOINT_URL`、`COMMAND_TYPE`、`SHARD_INDEX` など）を読み込み、ffmpeg/awk pipeline によって生成された log file を watch。JSON payloads を callback endpoint に POST。`SHARD_INDEX` が設定されている場合（thread mode）、それは callback payload に含まれるため、Bot が run numbers を `#N-XX` にレンダリングできます。non-thread runs では省略。Encoding 中に background process として実行。 |

### Composite Action（`.github/actions/check-and-convert-files/`）

**Name:** `Check and Convert Files`

**Purpose:** Total download sizeをvalidateし、Discordの10 MB per-attachment limitに収まるようにtwo-pass HEVC（H.265）+ Opus encodingでoversized filesをre-encode。

**Inputs:**
- `endpoint_url` — Bot callback URL（progress updates用）
- `run_number` — GitHub Actions run ID
- `start_time` — Workflow start timestamp（elapsed timeの計算に使用）
- `channel` — Discord channel/thread ID
- `message` — Discord message ID（in-thread edits用のplaceholder、`/dl` 用のfollow-up）
- `token` — Discord interaction token（edit operations用）
- `link` — Original media URL（callbacksでecho back）
- `command_type` — Optional；`/threaddl` / `/threaddl-spoiler` の場合のみ設定し、callbacksをcorrectにルーティング
- `shard_index` — Optional；zero-padded matrix shard index（例：`"01"`、`"02"`）。`conv_progress.sh` に `SHARD_INDEX` environment variableとして渡されます。progress callbacksがindexを含むため、Botがrun numbersを `#N-XX` にレンダリングできます。`/dl` / `/dl-spoiler`（non-thread）runsでは省略。

**Workflow:**
1. Total download sizeが ≤ 10 MBの場合、encodingは不要。uploadに進行。
2. いずれかのファイルが > 10 MBの場合：
   - **Probe step:** ファイルのmiddleの5% をサンプリング。target encoding settingsでoverheadとbitrate requirementsをestimate。
   - **Analyze step**（first pass）： HEVC analysis passを実行してoptimal two-pass encoding用のstatisticsをgather。
   - **Convert step**（second pass）： HEVC video（Opus audio）を使用してencode。Bitrateは10 MBに収まり品質を保持するよう計算。Safety capとして `-fs 10MB` limitを使用。
3. Process全体を通じてprogress callbacksを送信（phase labels `🔎Probing...`、`🧪Analyzing...`、`🔁Converting...` 付き）。`conv_progress.sh` 経由。

**Called by:** `run.yml`（`/dl`、`/dl-spoiler` 用）と `run-thread.yml`（`/threaddl`、`/threaddl-spoiler` 用）の両方。

## Secrets

| Where | Name | Purpose |
| --- | --- | --- |
| Bot environment | `DISCORD_TOKEN` | Discord bot token。 |
| Bot environment | `DISPATCH_URL` | runner repo の `repository_dispatch` URL。`download` と `thread-download` event types の両方で使用。 |
| Bot environment | `GITHUB_TOKEN` | `DISPATCH_URL` を呼び出す際に Bot によって使用される PAT。[development.md](./development.md#github-token-scopes) を参照。 |
| GitHub Actions（runner repo） | `ENDPOINT_URL` | Bot の `/api/callback` の public URL。`run.yml` と `run-thread.yml` の両方が progress / success / failure callbacks を送信する際に使用。 |
| GitHub Actions（built-in） | `GITHUB_TOKEN` | runner image を GHCR にプッシュする際に `build.yml` で使用（`packages: write`）。また `run.yml` と `run-thread.yml` で GHCR pull を authenticate する際に使用。Actions で提供；manually configure は不要。 |

## Runner workflow steps（`run.yml`、単一 URL）

`.github/workflows/run.yml` はentirely within prebuilt runner containerで実行。主要ステップ：

1. **Masking Secrets** — `commandType`、`link`、`channel`、`message`、`token` を `::add-mask::` でマスク。logsに決して出現しない。
2. **Start Steps / Setup** — `progress` callbacksを `⏳Starting...`、`🛠Setup...` などを投稿。`yt-dlp` がlatest nightlyであることをensure。
3. **Confirmation of link survival** — supplied URLに対して `GET` を発行（`curl -siL`、headers + follow redirects、body discard）。dead linksで早期bail。
4. **Start Download** — earlier stepsが記述したbash/awk scriptsで定義されたstreaming progress hooksを付けて `yt-dlp` を実行。
5. **Check and Convert Files** — needed時ffmpeg経由でre-encode。
6. **Upload files** — multipart parts（`actionType: single` または `multi`）としてアタッチされた結果のファイルを `/api/callback` にsuccess callbackを送信。
7. **Failure paths** — "Link has expired"、"Video file not found"、"Uploaded file size exceeded"、"Download timed out" のexplicit `failure` callbacks。
8. **Cleanup temp files** — always runs。

## Runner workflow steps（`run-thread.yml`、matrix fan-out）

`.github/workflows/run-thread.yml` は2つのjobsで実行：

### `prepare` job

`client_payload.links` からstrategy matrixを構築：

```bash
matrix="$(jq -c '{include: [.client_payload.links | to_entries[] | {index: ((.key + 1) | tostring | if length < 2 then ("0" + .) else . end), link: .value.link, message: .value.message}]}' "${GITHUB_EVENT_PATH}")"
count="$(jq -r '.client_payload.links | length' "${GITHUB_EVENT_PATH}")"
```

outputはnext jobの `strategy.matrix` でconsumedされる `{"include": [{"index": "01", "link": "...", "message": "..."}, {"index": "02", "link": "...", "message": "..."}, ...]}` 形式のJSON object。各エントリーは `index` フィールドを含みます。array positionから導出されたzero-padded 2桁のshard number（01、02、…）。shared thread channel ID、`commandType`、`token`、`startTime` はtop-level event payloadから来し、すべてのshardsによって読み込まれます。

### `run-with-container` job

`if: ${{ fromJson(needs.prepare.outputs.count) > 0 }}` で実行。`strategy.matrix: ${{ fromJson(needs.prepare.outputs.matrix) }}`、`fail-fast: false`、`max-parallel: 16` を付けて。job名は `Download #${{ matrix.index }}`（例：`Download #01`、`Download #02`）。Tweet URLsがpublicなGitHub Actions job listに表示されないようsecurity/privacy layerとして機能します。Discord interactions（links、channel IDs）は既に `::add-mask::` via step-levelでmaskedですが、GitHubのmatrix expansionはmaskingより前に起こるため、numeric indexが代わりに使用されます。

各shardは `matrix.link`、`matrix.message`、`matrix.index` を受け取ります。そうでなければstepsは `run.yml` をミラー：

1. **Masking Secrets** — `commandType`、`channel`、`token`、`matrix.link`、`matrix.message` をマスク。
2. **Start Steps / Setup** — `progress` callbacksはoriginal `commandType`（`"threaddl"` または `"threaddl-spoiler"`）を含むため、Botがper-shard placeholderを `editMessage` で編集するために `ProgressThread` / `ProgressThreadSpoiler` 経由でそれらをルーティング。
3. **Confirmation of link survival → Start Download → Check and Convert Files → Upload files** — identical pipeline。`actionType=thread-single` または `thread-multi` をsuccess callbackでset。
4. **Failure paths** — `run.yml` と同じexplicit `failure` callbacks。original `commandType` echo back。
5. **Cleanup temp files**.

各shardは独自の `matrix.message` をknowするため、すべてのcallbacksは他のshardsに対してindependentlyにthread内のright placeholderを編集。workflow自体は **commandType-agnostic** — `commandType` はopaquelyに渡される。spoiler vs. non-spoiler branchingはentirelyにBot sideでsuccess-handler routing table経由で起こります。

## CI workflow（`test.yml`）

`pull_request` および `master` への `push` 時にトリガー。ステップ：

1. `actions/checkout@v6`
2. `denoland/setup-deno@v2`（Deno `v2.x`）
3. `deno lint`
4. `deno task test`（env vars `DISCORD_TOKEN` / `DISPATCH_URL` / `GITHUB_TOKEN` はtask definition内のplaceholdersとして事前設定）
5. `deno task test:coverage | tee coverage.txt`
6. Always：`coverage.txt` のcontentsをGitHub Step Summaryにappend。reviewersがworkflow run pageでcoverage reportを直接見るために。

## When you change the schema

pipelineの各エンドをupdate：

- `src/libs/webhook.ts`（GitHubに行くrequest shape）、
- `src/router/types/callbackTypes.ts`（戻ってくるresponse shape）、
- `src/libs/custom.ts`（any new routing pattern）、
- `.github/workflows/run.yml` and/or `.github/workflows/run-thread.yml`（responseのproducers）、
- このドキュメントと `docs/architecture.md` のstatus-lifecycle table内の対応するrows。
