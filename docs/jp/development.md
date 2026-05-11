> English: [../development.md](../development.md)

# Development（開発）

## Prerequisites

- [Deno](https://deno.land/) — BotはTypeScriptで書かれており、Deno上で実行されます。正確なバージョンは `deno.json` でpinされていません。最近の安定リリースでかまいません。
- [denon](https://deno.land/x/denon) — `deno task dev` で使用。ファイルウォッチングreloads（`scripts.json`）。
- Discord application with a bot token。
- runner workflowをホストし、`repository_dispatch` eventsを受け付けるGitHub repository。
- repository eventsをディスパッチするpermissionを持つGitHub Personal Access Token（PAT）（下記「GitHub token」参照）。

## Repository layout（トップレベル）

```text
.
├── deno.json               # tasks (dev, lint, build, run, start, cache, test*)
├── scripts.json            # denon config used by `deno task dev`
├── import_map.json         # import map for std + third-party deps
├── src/                    # bot + router + libs + utils + main entry
├── tests/                  # Deno test suite, mirrors the src/ tree
├── tools/textlint.ts       # custom textlint runner used by `deno task lint`
├── docker/Dockerfile       # runner image (Ubuntu + ffmpeg + yt-dlp)
└── .github/workflows/      # build.yml (image), run.yml + run-thread.yml (downloads), test.yml (CI)
```

## Environment variables

Botは `Constants.SECRETS`（`src/libs/secrets.ts`）内のいずれかの変数がmissingな場合、startupでfast failします。

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Discord bot token。discordeno が gateway と REST calls を authenticate するために使用。 |
| `DISPATCH_URL` | yes | GitHub `repository_dispatch` endpoint の完全 URL、例：`https://api.github.com/repos/<owner>/<repo>/dispatches`。 |
| `GITHUB_TOKEN` | yes | `DISPATCH_URL` に POST する際 `Authorization: token <...>` として使用される PAT。 |

repository rootの `.env` ファイルがruntimeで読み込まれます（プロジェクトは `@redpeacock78/unienv` を使用して環境を通じてenv varsをuniformlyに読み込みます）。実際のsecretsをコミットしないでください — `.env` をローカルで無視して、共有する際はplaceholder valuesを使用。

### GitHub token scopes

`GITHUB_TOKEN` として使用されるPATは、target repositoryで `repository_dispatch` をトリガーするように許可される必要があります：

- **Classic PAT：** `repo` scope（またはpublic repoの場合は最低限 `public_repo`）と `workflow` で十分です。
- **Fine-grained PAT：** target repositoryにアクセスをgrant。**Contents: Read and write** と **Metadata: Read-only** を付与。dispatch endpointはrepository write accessでゲートされます。

runner workflow自体はbuilt-in `GITHUB_TOKEN`（`packages: write` 付き）を使用してrunner imageをGHCRにプッシュします — これは `build.yml` で設定され、上記のPATとは別です。

## Common tasks

以下のすべてのタスクは `deno.json` で定義されています（`dev` / `lint` はdenonのために `scripts.json` でもmirror）。

```bash
# Watch-and-reload development server
deno task dev

# Run the bot once (no reload)
deno task run

# Cache imports declared in import_map.json
deno task cache

# Lint TypeScript and run textlint over docs/jp/
deno task lint

# Auto-fix textlint findings in docs/jp/
deno task lint:fix

# Compile a self-contained binary into ./build/main
deno task build

# Run the compiled binary
deno task start

# Run the Deno test suite under tests/
deno task test

# Run tests with file-watching reloads
deno task test:watch

# Run tests with coverage; prints a `deno coverage` summary
deno task test:coverage
```

`deno task lint` は以下を実行します。

1. すべての TypeScript ソースに対して `deno lint` を実行します。`tools/` ディレクトリは `deno.json` の `lint.exclude` フィールド経由で除外されます（`tools/textlint.ts` が `npm:` specifier を使用するため lint のデフォルトに引っかかります）。
2. `deno run --allow-env --allow-read --allow-sys tools/textlint.ts docs/jp/` — `.textlintrc` をロードし、引数として渡されたパスを lint する custom runner です。runner は `docs/jp/` を再帰的にスキャンして Markdown ファイルを検出します。`deno task lint:fix` は runner を `--fix`（および `--allow-write`）付きで呼び直し、自動修正可能なルールをその場で適用します。

`tools/textlint.ts` 内の `npm:textlint`・`npm:textlint-plugin-jsx`・`npm:textlint-rule-preset-ja-*` は major version 単位でピン留めしています。ピン留めしない場合、Deno の npm リゾルバが古い `typed-array-byte-offset@1.0.2` を取得し、Deno 2.x の node 互換レイヤ初期化時に `TypeError: Cannot convert undefined or null to object` で失敗します。

### Tests

Deno test suiteは `tests/` の下に住み、`src/` の構造に加えて、scriptsとutilities用の追加テストディレクトリをミラーリング。Test subdirectoriesは以下を含む：

- **`tests/bot/`** — slash commandsとinteraction handlers（`interactionCreate`、`registerCommands` など）用のテスト。
- **`tests/router/`** — callback routing、message editing（thread vs. non-thread）、health checks用のテスト。
- **`tests/libs/`** — webhook payloads、message builders、secrets loading用のテスト。
- **`tests/scripts/`** — subprocess executionを伴う `deno test` によるshell scriptsとAWK tools用のテスト（`--allow-run`、`--allow-write`、`--allow-net` が必要）。

3つすべての `test*` タスクは `DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` に対してplaceholder valuesを事前設定するため、transitivelyに `Secrets` をロードするmodulesをインポートしてもmissing env varsで失敗しません。Testsは `bot.helpers.*` と `ky` をファイルごとにstub（real network callsではなく）します。Testsは `--allow-env`、`--allow-read`、`--allow-run`、`--allow-write`、`--allow-net` permissionsで実行され、script testingとfile operationsをサポート。

単一テストの例（すべての必要なpermissions付き）：

```bash
deno test --import-map import_map.json --allow-env --allow-read --allow-run --allow-write --allow-net tests/path/to/file.test.ts
```

`DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` をdummy values（任意のnon-empty string）に設定して、`secrets.ts` validationを満たす。

### Coverage

```bash
# Run the test suite and produce a `coverage/` profile
deno task test:coverage
```

`deno task test:coverage` はraw profile dataを `coverage/` に書き込み、per-file tableをprint、`coverage/lcov.info` と `coverage/html/index.html` を生成します。ローカルでline-level coverageを閲覧するには、HTML reportをopen：

```bash
open coverage/html/index.html   # macOS
xdg-open coverage/html/index.html   # Linux
```

CI（`.github/workflows/test.yml`）はさらに `deno coverage coverage --lcov > coverage.lcov` を実行し、結果を [`codecov/codecov-action@v5`](https://github.com/codecov/codecov-action) 経由で **Codecov** にアップロード。Configurationは [`codecov.yml`](../../codecov.yml)に住んでいます：

- `tools/`、`tests/`、`docker/`、`**/*.test.ts` は無視。
- `project` status：`target: auto`、`threshold: 1%` — overall coverage dropsを1% より大きくフラグ。
- `patch` status：`target: 70%`、`threshold: 1%` — すべてのPRのnew/modified linesは70% に達する必要があります。

dashboardは <https://app.codecov.io/gh/redpeacock78/tw-dl-bot> にあります。`README.md` のバッジはmaster-branch percentageをミラー。

### What runs at startup

`src/main.ts`：

1. `Secrets` をロード（missing env varsでfast fail。これは `import` chain経由でimplicitに起こります。`bot.ts` がdiscordeno clientを構築する際に `Secrets.DISCORD_TOKEN` を読み込むため）。
2. `await registerCommands(bot)`（`src/bot/registerCommands.ts`）を呼び出して `dl`、`dl-spoiler`、`threaddl` をglobal slash commandsとして登録。これは以前はtop-level `await` inside `bot.ts` でしたが、`bot.ts` をインポートすることがunit testsのためにside-effect-freeになるようにextract。
3. `startBot(bot)` を呼び出してDiscord gateway connectionを開く。
4. Hono appを `/api` にマウントし、`std/http/server` から `serve` helper経由でserve。
5. Bot status（`Bot.updateRAMUsage2BotStatus`、10秒ごと）でperiodic RAM-usage updateを開始。

HTTP serverはデフォルトで `0.0.0.0:8000` をリッスン（`https://deno.land/std@0.193.0/http/server.ts` からの `serve` が実際に使用されます — `Deno.serve` ではなく）。ローカルで開発する場合、このポートをpublic internetに公開（例えば [ngrok](https://ngrok.com/) または [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)）し、`ENDPOINT_URL` をGitHub Actions secretsで `/api/callback` のpublic URLに設定。

## Troubleshooting

- **`Not all secrets are set.`** — `DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` の1つがmissingまたはempty。
- **No interactions received** — Botがguildに招待される際に `applications.commands` と `bot` scopesを持つことを確認。
- **`repository_dispatch` returns 404** — `DISPATCH_URL` がwrong、PATがscopeを欠落、またはワークフローファイルがmatching `on.repository_dispatch.types` を宣言していない（`/dl` & `/dl-spoiler` 用 `download`、`/threaddl` 用 `thread-download`）。
- **`/threaddl` replies "This command must be used in a guild text channel."** — interactionがDMから来た。Threadsはguild text/announcement/forum channel内でのみ作成できます。Botは `startThreadWithoutMessage` を呼び出す前に `interaction.guildId` をチェックしてこれをenforce。
- **Callbacks never reach the bot** — `ENDPOINT_URL`（GH Actions secret）はpublicly reachable `/api/callback` を指していない。tunnel logsをチェック。
- **`/dl` follow-up edits stop after 15 minutes** — Discordはoriginal interactionのlifetime過去のfollow-up message editsをrate-limit。Botはこれを `Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` 経由でenforce。`/threaddl` はunaffected（thread placeholdersは `editMessage` 経由で編集され、そのwindowにboundされない）。
