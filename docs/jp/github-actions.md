> English: [../github-actions.md](../github-actions.md)

# GitHub Actions Integration

Bot は すべての `yt-dlp` 作業を GitHub Actions にオフロード。4 つのワークフローが関係：

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

Bot は同じ `ky.post` plumbing in `src/libs/webhook.ts` で 2 つの distinct dispatch payloads を使用。

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

Bot はユーザーが複数の URL を `/dl` に渡す場合、URL ごとに 1 つのディスパッチを火します。

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

`channel` ここは **thread** ID。`startThreadWithoutMessage` によって返された、original source channel ではなく。各 `links[i].message` は thread 内に投稿された placeholder の ID。同じ workflow が両方の `commandType` values を処理 — `commandType` は callback ごとに echo back され、Bot の router が spoiler vs. non-spoiler success handler をピックするために使用。

interaction.token ここは **ModalSubmit** interaction token（original ApplicationCommand token ではなく）。`runThreadFlow` は Modal handshake の 2 番目のハーフで実行するため。

`DISPATCH_URL` は conventionally `https://api.github.com/repos/<owner>/<repo>/dispatches`。

`run.yml` と `run-thread.yml` の両方は `${{ github.event.client_payload.* }}` 経由でこれらのフィールドを consume し、user-controlled values を `::add-mask::` でマスク。public log の外に。`run-thread.yml` は shard ごとに `matrix.link` と `matrix.message` も mask。

## Callback: `POST /api/callback`

runner は `ENDPOINT_URL` Actions secret の URL に投稿（Bot の public `/api/callback` に resolve される）。両方のワークフローは同じ endpoint に同じ body schema で投稿。`CallbackTypes.bodyDataObject` in `src/router/types/callbackTypes.ts` で定義：

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
| `convert` | `"true" \| "false"`（optional） | runner がファイルを re-encode する必要があったかどうか。 |
| `oversize` | `"true" \| "false"`（optional） | `"true"` when 結果のファイルが Discord のアップロード limit を exceeded。non-thread mode の場合、Bot は fresh `sendMessage` 経由でファイルを surface。thread mode（`useThread`）の場合、Bot は placeholder を in-place で編集。 |
| `name1`..`name4`、`file1`..`file4` | `string` / `File`（optional） | 1 から 4 つの結果ファイルをアップロード時のファイル名と `multipart/form-data` parts。 |
| `size` | `string`（optional） | Total upload size in bytes（success embeds で使用）。 |
| `type` | `string` | runner からの free-form context tag。 |
| `content` | `string`（optional） | `progress` callbacks 中に user に表示される step 説明。例えば `🛠Setup...`。 |

Progress callbacks は `application/json` として ship。Success callbacks with attachments は `multipart/form-data` で送信（router は両方を parse）。

### Status routing

router は `Custom.CallbackPattern`（`src/libs/custom.ts`）を使用して `[status, commandType, actionType]` に基づいて handler をピック。

**Routing structure:**

- **Success callbacks** use a union of two disjoint sub-products: (`dl` / `dl-spoiler` × `single` / `multi`) ∪ (`threaddl` / `threaddl-spoiler` × `thread-single` / `thread-multi`) = 4 + 4 = 8 entries。各々が uniquely routed。`status` は常に `"success"`。
- **Progress and failure callbacks** use a subset-first match: thread-specific patterns（`commandType === "threaddl"` または `commandType === "threaddl-spoiler"`、`actionType` nullish）は generic patterns（`commandType` nullish、`actionType` nullish）**の前に** checked される必要があります。なぜなら order が反対なら両方のパターンが thread-mode callback にマッチ。`actionType` は runner からの progress / failure callbacks で省略されるため、matching は `status` と `commandType` のみに依存。

Thread-mode patterns は `Custom.CallbackPattern` で non-thread patterns の **前に** list：

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

handler implementation 自体は shared：`callbackSuccessFunctions.ts` は `dl`、`dlSpoiler`、`threadDl`、`threadDlSpoiler` を 2 つの private helpers の周りの thin wrappers としてエクスポート。`handleSingleSuccess(infoObject, spoiler, useThread)` と `handleMultiSuccess(infoObject, spoiler, useThread)`。`spoiler` と `useThread` flags のみが 8 つの entry points（`{single, multi} × {dl, dlSpoiler, threadDl, threadDlSpoiler`）で異なります。`useThread === true` は message builders in `successMessage.ts` を `editFollowupMessage` の代わりに `bot.helpers.editMessage(channel, message)` を使用させ、oversize / 15 分 fallback gates を short-circuit。

### Response codes

body は parse され、`[status, commandType, actionType]` triplet は `Custom.CallbackPattern` に対して matched された後に `src/router/callback.ts` で決定：

| Code | When |
| --- | --- |
| `204 No Content` | handler が ran、Discord API call に成功。 |
| `400 Bad Request` | body は parsed（JSON または multipart）。但し `status`、`commandType`、`actionType` はすべて missing — `InvalidPost` pattern。 |
| `500 Internal Server Error` | `.otherwise` にフォールスルー — body-parse failures と `Custom.CallbackPattern` に列挙されない `[status, commandType, actionType]` combination に使用。handler 内の Discord API errors も handler の `.catch` によって `500` としてレポート。 |

## Runner processing pipeline

Runner workflows（`run.yml` と `run-thread.yml`）は Docker container 内で実行され、shell scripts と composite GitHub Actions を使用して download、encoding、upload workflow を管理。

### Shell scripts（`.github/scripts/`）

| Script | Purpose |
| --- | --- |
| `progress.awk` | AWK script。FFmpeg progress output（`frame=...time=HH:MM:SS...`）をパースし、ETA estimates 付きで readable time markers としてフォーマット。Composite action の ffmpeg encoding pipeline によって（`awk -f progress.awk` 経由で）呼び出され、progress log file に書き込み。 |
| `retry_curl.sh` | Bash script。`curl` を exponential backoff retry logic でラップ。Transient errors（5xx、429、408）に対して configurable limit（最大遅延 60s）までリトライ。Bot の `/api/callback` への robust callback delivery に使用。 |
| `post_process.sh` | Bash script。Video ファイルを validate し、必要に応じて libx264 single-pass encoding を使用して H.264/MP4 format に変換。FFprobe を使用して format/codec/pixel format をチェックし、まだ H.264 + yuv420p でない場合は FFmpeg 経由で re-encode。Discord と downstream processing との互換性を ensure。 |
| `conv_progress.sh` | Bash script。Progress log file の変更を監視し、Bot へ real-time progress callbacks を送信。Environment variables（`ENDPOINT_URL`、`COMMAND_TYPE` など）を読み込み、ffmpeg/awk pipeline によって生成された log file を watch。JSON payloads を callback endpoint に POST。Encoding 中に background process として実行。 |

### Composite Action（`.github/actions/check-and-convert-files/`）

**Name:** `Check and Convert Files`

**Purpose:** Total download size を validate し、Discord の 10 MB per-attachment limit に収まるように two-pass HEVC（H.265）+ Opus encoding で oversized files を re-encode。

**Inputs:**
- `endpoint_url` — Bot callback URL（progress updates 用）
- `run_number` — GitHub Actions run ID
- `start_time` — Workflow start timestamp（elapsed time の計算に使用）
- `channel` — Discord channel/thread ID
- `message` — Discord message ID（in-thread edits 用の placeholder、`/dl` 用の follow-up）
- `token` — Discord interaction token（edit operations 用）
- `link` — Original media URL（callbacks で echo back）
- `command_type` — Optional；`/threaddl` / `/threaddl-spoiler` の場合のみ設定し、callbacks を correct にルーティング

**Workflow:**
1. Total download size が ≤ 10 MB の場合、encoding は不要。upload に進行。
2. いずれかのファイルが > 10 MB の場合：
   - **Probe step:** ファイルの middle の 5% をサンプリング。target encoding settings で overhead と bitrate requirements を estimate。
   - **Analyze step**（first pass）： HEVC analysis pass を実行して optimal two-pass encoding 用の statistics を gather。
   - **Convert step**（second pass）： HEVC video（Opus audio）を使用して encode。Bitrate は 10 MB に収まり品質を保持するよう計算。Safety cap として `-fs 10MB` limit を使用。
3. Process 全体を通じて progress callbacks を送信（phase labels `🔎Probing...`、`🧪Analyzing...`、`🔁Converting...` 付き）。`conv_progress.sh` 経由。

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

`.github/workflows/run.yml` は entirely within prebuilt runner container で実行。主要ステップ：

1. **Masking Secrets** — `commandType`、`link`、`channel`、`message`、`token` を `::add-mask::` でマスク。logs に決して出現しない。
2. **Start Steps / Setup** — `progress` callbacks を `⏳Starting...`、`🛠Setup...` など を投稿。`yt-dlp` が latest nightly であることを ensure。
3. **Confirmation of link survival** — supplied URL に対して `GET` を発行（`curl -siL`、headers + follow redirects、body discard）。dead links で早期 bail。
4. **Start Download** — earlier steps が記述した bash/awk scripts で定義された streaming progress hooks を付けて `yt-dlp` を実行。
5. **Check and Convert Files** — needed時 ffmpeg 経由で re-encode。
6. **Upload files** — multipart parts（`actionType: single` または `multi`）としてアタッチされた結果のファイルを `/api/callback` に success callback を送信。
7. **Failure paths** — "Link has expired"、"Video file not found"、"Uploaded file size exceeded"、"Download timed out" の explicit `failure` callbacks。
8. **Cleanup temp files** — always runs。

## Runner workflow steps（`run-thread.yml`、matrix fan-out）

`.github/workflows/run-thread.yml` は 2 つの jobs で実行：

### `prepare` job

`client_payload.links` から strategy matrix を構築：

```bash
matrix="$(jq -c '{include: [.client_payload.links[] | {link: .link, message: .message}]}' "${GITHUB_EVENT_PATH}")"
count="$(jq -r '.client_payload.links | length' "${GITHUB_EVENT_PATH}")"
```

output は next job の `strategy.matrix` で consumed される `{"include": [{"link": "...", "message": "..."}, ...]}` 形式の JSON object。shared thread channel ID、`commandType`、`token`、`startTime` は top-level event payload から来し、すべての shards によって読み込まれます。

### `run-with-container` job

`if: ${{ fromJson(needs.prepare.outputs.count) > 0 }}` で実行。`strategy.matrix: ${{ fromJson(needs.prepare.outputs.matrix) }}`、`fail-fast: false`、`max-parallel: 16` を付けて。各 shard は `matrix.link` と `matrix.message` を受け取ります。そうでなければ steps は `run.yml` をミラー：

1. **Masking Secrets** — `commandType`、`channel`、`token`、`matrix.link`、`matrix.message` をマスク。
2. **Start Steps / Setup** — `progress` callbacks は original `commandType`（`"threaddl"` または `"threaddl-spoiler"`）を含むため、Bot が per-shard placeholder を `editMessage` で編集するために `ProgressThread` / `ProgressThreadSpoiler` 経由でそれらをルーティング。
3. **Confirmation of link survival → Start Download → Check and Convert Files → Upload files** — identical pipeline。`actionType=thread-single` または `thread-multi` を success callback で set。
4. **Failure paths** — `run.yml` と同じ explicit `failure` callbacks。original `commandType` echo back。
5. **Cleanup temp files**.

各 shard は独自の `matrix.message` を know するため、すべての callbacks は他の shards に対して independently に thread 内の right placeholder を編集。workflow 自体は **commandType-agnostic** — `commandType` は opaquely に渡される。spoiler vs. non-spoiler branching は entirely に Bot side で success-handler routing table 経由で起こります。

## CI workflow（`test.yml`）

`pull_request` および `master` への `push` 時にトリガー。ステップ：

1. `actions/checkout@v6`
2. `denoland/setup-deno@v2`（Deno `v2.x`）
3. `deno lint`
4. `deno task test`（env vars `DISCORD_TOKEN` / `DISPATCH_URL` / `GITHUB_TOKEN` は task definition 内の placeholders として事前設定）
5. `deno task test:coverage | tee coverage.txt`
6. Always：`coverage.txt` の contents を GitHub Step Summary に append。reviewers が workflow run page で coverage report を直接見るために。

## When you change the schema

pipeline の各エンド を update：

- `src/libs/webhook.ts`（GitHub に行く request shape）、
- `src/router/types/callbackTypes.ts`（戻ってくる response shape）、
- `src/libs/custom.ts`（any new routing pattern）、
- `.github/workflows/run.yml` and/or `.github/workflows/run-thread.yml`（response の producers）、
- このドキュメント と `docs/architecture.md` の status-lifecycle table 内の対応する rows。
