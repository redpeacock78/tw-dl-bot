> English: [../deployment.md](../deployment.md)

# Deployment（デプロイ）

このプロジェクトのデプロイ可能な surface には 2 つのピースがあります：

1. **Bot service**（`src/main.ts`）— Discord に到達し、GitHub Actions からの inbound HTTP を受け入れることができる long-running Deno process。
2. **Runner image**（`docker/Dockerfile`）— `.github/workflows/run.yml`（single-URL）と `.github/workflows/run-thread.yml`（`/threaddl` の matrix fan-out）の両方で消費される Docker image。`.github/workflows/build.yml` によって自動的にリビルド。

## 1. Runner image

Runner は Ubuntu ベースの image。yt-dlp が runtime で必要とするツール：`ffmpeg`、`aria2`、`jq`、`bc`、`gawk`、`curl`。`yt-dlp` 自体は stable binary としてダウンロードされてから、同じ `RUN` layer 内で直ちに最新の nightly build に switch。

### Automatic build（デフォルト）

`.github/workflows/build.yml` は `ghcr.io/<owner>/tw-dl-runner:latest` をビルドしてプッシュ：

- `master` への `push` のたびに、および
- daily schedule で（`0 15 * * *` UTC）。

workflow の built-in `GITHUB_TOKEN`（job permissions block で `packages: write` を granted）で GHCR にログインし、`docker build -f docker/Dockerfile -t <image> ./docker` を実行してから `docker push` を実行。

### Manual build（テスト用）

```bash
IMAGE=ghcr.io/<owner>/tw-dl-runner:latest
docker build -f docker/Dockerfile -t "${IMAGE}" ./docker
echo "${CR_PAT}" | docker login ghcr.io -u "<your-username>" --password-stdin
docker push "${IMAGE}"
```

両方の runner workflows は常に `:latest` をプル。successful push で十分に新しい runner をロールアウト — application redeploy は不要。

## 2. Bot service

Bot は任意の環境にデプロイできます。以下が可能な environment：

- `discord.com` に到達（gateway + REST）、
- `api.github.com` に到達して `repository_dispatch` events を POST、
- `github.com` の Actions runners からの inbound HTTPS を `/api/callback` で受け入れ。

### Build

```bash
deno task build
```

`deno compile -A --import-map import_map.json -o build/main src/main.ts` 経由で `./build/main` に self-contained executable を生成。compile は `-A`（all permissions）を使用 — 実行する前に hosting environment の期待を review。

### Run

```bash
DISCORD_TOKEN=...
DISPATCH_URL=https://api.github.com/repos/<owner>/<repo>/dispatches
GITHUB_TOKEN=...
deno task start   # runs ./build/main
```

または、compile なし：

```bash
deno task run
```

Hono server は `std/http/server`（`https://deno.land/std@0.193.0/http/server.ts`）から `serve` helper 経由で served。デフォルトで `0.0.0.0:8000` をリッスン。

### Required environment variables

[development.md](./development.md#environment-variables) の同じテーブルを参照。variables は local development と production で同一。PAT（`GITHUB_TOKEN`）を long-lived credential として扱う — schedule で rotate。

### Reverse proxy / TLS

Discord と GitHub の両方は webhook style endpoints に対して HTTPS を要求。TLS を reverse proxy（Caddy、nginx、Cloudflare Tunnel、fly.io edge など）で terminate し、Bot の HTTP port に forward。callback path は `https://<your-host>/api/callback` として reachable である必要があります。

### GitHub Actions secret

`ENDPOINT_URL` を **target repository の** Actions secrets に設定。Bot の callback endpoint の public URL、例えば：

```text
ENDPOINT_URL = https://bot.example.com/api/callback
```

`run.yml` と `run-thread.yml` の両方は progress / success / failure updates を投稿する際に使用。

### Bot permissions in Discord

`/dl` と `/dl-spoiler` の場合、Bot は standard message-send と attachment scopes が必要。

`/threaddl` と `/threaddl-spoiler` の場合、Bot は source guild text channel で **2 つの distinct** permissions が必要。失敗方法が **異なり**、user-visible symptoms も **異なる** — operators は両方とも verify する必要があります。no error embed が現れなかったことだけではなく：

| Missing permission | Failure path | What the user sees |
| --- | --- | --- |
| **Create Public Threads** | `bot.helpers.startThreadWithoutMessage(...)` は REST layer で reject。`runThreadFlow` の `.catch` は error embed を投稿して停止。 | source channel に `Failed to create thread: <reason>` error embed。thread は作成されず、nothing がディスパッチ。 |
| **Send Messages in Threads** | thread *は* 作成されます（2 つの permissions は independent）が、すべての URL ごとの `bot.helpers.sendMessage(thread.id, ...)` placeholder は reject。Bot は各 rejection を silent に swallow（`.catch((): null => null)`）し、`links.length === 0` で short-circuit。 | source channel に `🧵 Created thread <#thread-id> for N URL(s).` follow-up が現れ、空の thread が作成 — しかし **error embed なし**、Bot は runner workflow をディスパッチしない。 |

> **Operator note。** `/threaddl`（または `/threaddl-spoiler`）が「error なしで run」のように見えるが、新しい thread に何も現れない場合、2 番目の行を最初に疑う。

## Health check

```http
GET /api/ping  -> 200 OK with body "OK!"
```

uptime checks または load-balancer health probes に使用。

## Rolling out changes

| Change | What to redeploy |
| --- | --- |
| TypeScript source under `src/` | Bot service。 |
| `docker/Dockerfile` | Runner image（`master` にプッシュは `build.yml` をトリガー）。Bot redeploy は不要。 |
| `.github/workflows/run.yml` または `run-thread.yml` | Nothing — workflows は各ディスパッチで default branch から読み込まれ。 |
| `.github/workflows/test.yml` | Nothing — `pull_request` および `master` への `push` で実行。 |
| Slash command additions / removals | Bot service。`createGlobalApplicationCommand` は startup で `registerCommands` によって呼び出されます。Global commands は propagate に最大 1 時間かかる。 |

## Operational notes

- Bot は現在の RAM usage で presence を 10 秒ごとに更新（`UPDATE_BOT_STATUS_INTERVAL`）。
- `/dl` / `/dl-spoiler` の場合：Discord follow-up messages は original interaction の後 15 分の間のみ編集可能（`EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT`）。long-running downloads は workflow が running を続けていても、その window を過ぎると progress edits を受け取るのを停止。`/threaddl` placeholders は `editMessage`（a regular channel message edit）経由で編集され、この 15 分の window に影響されない。
- runner image は意図的に nightly で rebuild。`yt-dlp` とその dependencies が site changes に current のままになるようにするため。
- `run-thread.yml` は最大 16 shards を並列で実行（`strategy.max-parallel: 16`、`fail-fast: false`）。失敗した shards は他の URL が complete することを許可。
