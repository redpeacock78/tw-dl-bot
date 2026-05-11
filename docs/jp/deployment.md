> English: [../deployment.md](../deployment.md)

# Deployment（デプロイ）

このプロジェクトのデプロイ可能なsurfaceには2つのピースがあります。

1. **Bot service**（`src/main.ts`）— long-running Deno process。Discordに到達し、GitHub Actionsからのinbound HTTPを受け入れることができます。
2. **Runner image**（`docker/Dockerfile`）— Docker image。`.github/workflows/run.yml`（single-URL）で消費されます。`.github/workflows/run-thread.yml`（`/threaddl` のmatrix fan-out）でも同様に消費されます。`.github/workflows/build.yml` によって自動的にリビルドされます。

## 1. Runner image

RunnerはUbuntuベースのimage。yt-dlpがruntimeで必要とするツール：`ffmpeg`、`aria2`、`jq`、`bc`、`gawk`、`curl`。`yt-dlp` 自体はstable binaryとしてダウンロードされてから、同じ `RUN` layer内で直ちに最新のnightly buildにswitch。

### Automatic build（デフォルト）

`.github/workflows/build.yml` は `ghcr.io/<owner>/tw-dl-runner:latest` をビルドしてプッシュします。

- `master` への `push` のたびに、および
- daily scheduleで（`0 15 * * *` UTC）。

workflowのbuilt-in `GITHUB_TOKEN`（job permissions blockで `packages: write` をgranted）でGHCRにログインします。次に `docker build -f docker/Dockerfile -t <image> ./docker` を実行してから `docker push` を実行します。

### Manual build（テスト用）

```bash
IMAGE=ghcr.io/<owner>/tw-dl-runner:latest
docker build -f docker/Dockerfile -t "${IMAGE}" ./docker
echo "${CR_PAT}" | docker login ghcr.io -u "<your-username>" --password-stdin
docker push "${IMAGE}"
```

両方のrunner workflowsは常に `:latest` をプル。successful pushで十分に新しいrunnerをロールアウト — application redeployは不要。

## 2. Bot service

Botは任意の環境にデプロイできます。以下を満たすenvironmentが必要です。

- `discord.com` に到達（gateway + REST）、
- `api.github.com` に到達して `repository_dispatch` eventsをPOST、
- `github.com` のActions runnersからのinbound HTTPSを `/api/callback` で受け入れ。

### Build

```bash
deno task build
```

`deno compile -A --import-map import_map.json -o build/main src/main.ts` を実行します。`./build/main` にself-contained executableが生成されます。compileは `-A`（all permissions）を使用するため、実行する前にhosting environmentの期待をreviewしてください。

### Run

```bash
DISCORD_TOKEN=...
DISPATCH_URL=https://api.github.com/repos/<owner>/<repo>/dispatches
GITHUB_TOKEN=...
deno task start   # runs ./build/main
```

または、compileなしでも実行できます。

```bash
deno task run
```

Hono serverは `std/http/server`（`https://deno.land/std@0.193.0/http/server.ts`）から `serve` helper経由でserved。デフォルトで `0.0.0.0:8000` をリッスン。

### Required environment variables

[development.md](./development.md#environment-variables) の同じテーブルを参照。variablesはlocal developmentとproductionで同一。PAT（`GITHUB_TOKEN`）をlong-lived credentialとして扱う — scheduleでrotate。

### Reverse proxy / TLS

DiscordとGitHubの両方はwebhook style endpointsに対してHTTPSを要求。TLSをreverse proxy（Caddy、nginx、Cloudflare Tunnel、fly.io edgeなど）でterminateし、BotのHTTP portにforward。callback pathは `https://<your-host>/api/callback` としてreachableである必要があります。

### GitHub Actions secret

`ENDPOINT_URL` を **target repository の** Actions secretsに設定します。Botのcallback endpointのpublic URLを指定します。例えば次のように設定します。

```text
ENDPOINT_URL = https://bot.example.com/api/callback
```

`run.yml` と `run-thread.yml` の両方はprogress / success / failure updatesを投稿する際に使用。

### Bot permissions in Discord

`/dl` と `/dl-spoiler` の場合、Botはstandard message-sendとattachment scopesが必要。

`/threaddl` と `/threaddl-spoiler` の場合、Botはsource guild text channelで **2 つの distinct** permissionsが必要です。失敗方法が **異なり**、user-visible symptomsも **異なる** — operatorsは両方ともverifyする必要があります。no error embedが現れなかったことだけではなく、以下の表に従って確認してください。

| Missing permission | Failure path | What the user sees |
| --- | --- | --- |
| **Create Public Threads** | `bot.helpers.startThreadWithoutMessage(...)` は REST layer で reject。`runThreadFlow` の `.catch` は error embed を投稿して停止。 | source channel に `Failed to create thread: <reason>` error embed。thread は作成されず、nothing がディスパッチ。 |
| **Send Messages in Threads** | thread *は* 作成されます（2 つの permissions は independent）が、すべての URL ごとの `bot.helpers.sendMessage(thread.id, ...)` placeholder は reject。Bot は各 rejection を silent に swallow（`.catch((): null => null)`）し、`links.length === 0` で short-circuit。 | source channel に `🧵 Created thread <#thread-id> for N URL(s).` follow-up が現れ、空の thread が作成 — しかし **error embed なし**、Bot は runner workflow をディスパッチしない。 |

> **Operator note。** `/threaddl`（または `/threaddl-spoiler`）が「error なしで run」のように見えるが、新しい thread に何も現れない場合、2 番目の行を最初に疑う。

## Health check

```http
GET /api/ping  -> 200 OK with body "OK!"
```

uptime checksまたはload-balancer health probesに使用。

## Rolling out changes

| Change | What to redeploy |
| --- | --- |
| TypeScript source under `src/` | Bot service。 |
| `docker/Dockerfile` | Runner image（`master` にプッシュは `build.yml` をトリガー）。Bot redeploy は不要。 |
| `.github/workflows/run.yml` または `run-thread.yml` | Nothing — workflows は各ディスパッチで default branch から読み込まれ。 |
| `.github/workflows/test.yml` | Nothing — `pull_request` および `master` への `push` で実行。 |
| Slash command additions / removals | Bot service。`createGlobalApplicationCommand` は startup で `registerCommands` によって呼び出されます。Global commands は propagate に最大 1 時間かかる。 |

## Operational notes

- Botは現在のRAM usageでpresenceを10秒ごとに更新（`UPDATE_BOT_STATUS_INTERVAL`）。
- `/dl` / `/dl-spoiler` の挙動。Discord follow-up messagesはoriginal interactionの後15分の間のみ編集可能（`EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT`）。long-running downloadsはworkflowがrunningを続けていても、そのwindowを過ぎるとprogress editsを受け取るのを停止。`/threaddl` placeholdersは `editMessage`（a regular channel message edit）経由で編集され、この15分のwindowに影響されない。
- runner imageは意図的にnightlyでrebuild。`yt-dlp` とそのdependenciesをsite changesへcurrentのまま保つためです。
- `run-thread.yml` は最大16 shardsを並列で実行（`strategy.max-parallel: 16`、`fail-fast: false`）。失敗したshardsは他のURLがcompleteすることを許可。
