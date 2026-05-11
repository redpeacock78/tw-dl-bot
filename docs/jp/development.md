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

repository rootの `.env` ファイルがruntimeで読み込まれます。プロジェクトは `@redpeacock78/unienv` を使用して環境を通じてenv varsをuniformlyに読み込みます。実際のsecretsをコミットしないでください。`.env` をローカルで無視して、共有する際はplaceholder valuesを使用してください。

### GitHub token scopes

`GITHUB_TOKEN` として使用されるPATは、target repositoryで `repository_dispatch` をトリガーするように許可される必要があります。

- **Classic PAT：** `repo` scope（またはpublic repoの場合は最低限 `public_repo`）と `workflow` で十分です。
- **Fine-grained PAT：** target repositoryにアクセスをgrant。**Contents: Read and write** と **Metadata: Read-only** を付与。dispatch endpointはrepository write accessでゲートされます。

runner workflow自体はbuilt-in `GITHUB_TOKEN`（`packages: write` 付き）を使用してrunner imageをGHCRにプッシュします。これは `build.yml` で設定され、上記のPATとは別です。

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

1. すべてのTypeScriptソースに対して `deno lint` を実行します。`tools/` ディレクトリは `deno.json` の `lint.exclude` フィールド経由で除外されます。これは `tools/textlint.ts` が `npm:` specifierを使用するためlintのデフォルトに引っかかるためです。
2. textlint runnerを呼び出します。コマンドは `deno run --allow-env --allow-read --allow-sys tools/textlint.ts docs/jp/` です。`.textlintrc` をロードし、引数として渡されたパスをlintするcustom runnerです。runnerは `docs/jp/` を再帰的にスキャンしてMarkdownファイルを検出します。`deno task lint:fix` はrunnerを `--fix`（および `--allow-write`）付きで呼び直します。自動修正可能なルールをその場で適用します。

`tools/textlint.ts` 内のnpm依存関係はmajor version単位でピン留めしています。対象は `npm:textlint`・`npm:textlint-plugin-jsx`・`npm:textlint-rule-preset-ja-*` です。ピン留めしない場合、Denoのnpmリゾルバが古い `typed-array-byte-offset@1.0.2` を取得します。Deno 2.xのnode互換レイヤ初期化時に `TypeError: Cannot convert undefined or null to object` で失敗します。

### Tests

Deno test suiteは `tests/` の下に住み、`src/` の構造に加えて、scriptsとutilities用の追加テストディレクトリをミラーリングします。Test subdirectoriesは以下を含みます。

- **`tests/bot/`** — slash commandsとinteraction handlers（`interactionCreate`、`registerCommands` など）用のテスト。
- **`tests/router/`** — callback routing、message editing（thread vs. non-thread）、health checks用のテスト。
- **`tests/libs/`** — webhook payloads、message builders、secrets loading用のテスト。
- **`tests/scripts/`** — subprocess executionを伴う `deno test` によるshell scriptsとAWK tools用のテストです。実行には `--allow-run`、`--allow-write`、`--allow-net` が必要です。

3つすべての `test*` タスクは `DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` に対してplaceholder valuesを事前設定します。これにより、transitivelyに `Secrets` をロードするmodulesをインポートしてもmissing env varsで失敗しません。Testsは `bot.helpers.*` と `ky` をファイルごとにstub（real network callsではなく）します。Testsは `--allow-env`、`--allow-read`、`--allow-run`、`--allow-write`、`--allow-net` permissionsで実行されます。これによりscript testingとfile operationsをサポートします。

単一テストの例（すべての必要なpermissions付き）は以下のとおりです。

```bash
deno test --import-map import_map.json --allow-env --allow-read --allow-run --allow-write --allow-net tests/path/to/file.test.ts
```

`DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` をdummy values（任意のnon-empty string）に設定します。これで `secrets.ts` validationを満たします。

### Coverage

```bash
# Run the test suite and produce a `coverage/` profile
deno task test:coverage
```

`deno task test:coverage` はraw profile dataを `coverage/` に書き込みます。per-file tableをprintし、`coverage/lcov.info` と `coverage/html/index.html` を生成します。ローカルでline-level coverageを閲覧するには、HTML reportをopenしてください。

```bash
open coverage/html/index.html   # macOS
xdg-open coverage/html/index.html   # Linux
```

CI（`.github/workflows/test.yml`）はさらに `deno coverage coverage --lcov > coverage.lcov` を実行します。結果を [`codecov/codecov-action@v5`](https://github.com/codecov/codecov-action) 経由で **Codecov** にアップロードします。Configurationは [`codecov.yml`](../../codecov.yml)に住んでいます。

- `tools/`、`tests/`、`docker/`、`**/*.test.ts` は無視。
- `project` status：`target: auto`、`threshold: 1%` — overall coverage dropsを1% より大きくフラグ。
- `patch` status：`target: 70%`、`threshold: 1%` — すべてのPRのnew/modified linesは70% に達する必要があります。

dashboardは <https://app.codecov.io/gh/redpeacock78/tw-dl-bot> にあります。`README.md` のバッジはmaster-branch percentageをミラー。

### What runs at startup

`src/main.ts`：

1. `Secrets` をロードします（missing env varsでfast fail）。これは `import` chain経由でimplicitに起こります。`bot.ts` がdiscordeno clientを構築する際に `Secrets.DISCORD_TOKEN` を読み込むためです。
2. `await registerCommands(bot)`（`src/bot/registerCommands.ts`）を呼び出します。これにより `dl`、`dl-spoiler`、`threaddl`、`threaddl-spoiler` をglobal slash commandsとして登録します。以前はtop-level `await` inside `bot.ts` で行っていました。これを `bot.ts` のインポートがunit testsのためにside-effect-freeとなるようextractしています。
3. `startBot(bot)` を呼び出してDiscord gateway connectionを開く。
4. Hono appを `/api` にマウントし、`std/http/server` から `serve` helper経由でserve。
5. Bot status（`Bot.updateRAMUsage2BotStatus`、10秒ごと）でperiodic RAM-usage updateを開始。

HTTP serverはデフォルトで `0.0.0.0:8000` をリッスンします。`https://deno.land/std@0.193.0/http/server.ts` からの `serve` が実際に使用されます（`Deno.serve` ではなく）。ローカルで開発する場合、このポートをpublic internetに公開します。例として [ngrok](https://ngrok.com/) や [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) が利用できます。さらに `ENDPOINT_URL` をGitHub Actions secretsで `/api/callback` のpublic URLに設定してください。

## Troubleshooting

- **`Not all secrets are set.`** — `DISCORD_TOKEN`、`DISPATCH_URL`、`GITHUB_TOKEN` の1つがmissingまたはempty。
- **No interactions received** — Botがguildへ招待される際に `applications.commands` と `bot` scopesを持つことを確認してください。
- **`repository_dispatch` returns 404** — 原因の候補は次のいずれかです。`DISPATCH_URL` がwrong、PATがscopeを欠落、ワークフローファイルがmatching `on.repository_dispatch.types` を宣言していない、のいずれかです。型は `/dl` および `/dl-spoiler` 用が `download`、`/threaddl` および `/threaddl-spoiler` 用が `thread-download` です。
- **`/threaddl` replies "This command must be used in a guild text channel."** — interactionがDMから来ています。Threadsはguild text/announcement/forum channel内でのみ作成できます。Botは `startThreadWithoutMessage` を呼び出す前に `interaction.guildId` をチェックします。これによりenforceします。
- **Callbacks never reach the bot** — `ENDPOINT_URL`（GH Actions secret）の設定誤りです。publicly reachableな `/api/callback` を指していません。tunnel logsをチェックします。
- **`/dl` follow-up edits stop after 15 minutes** — Discordの制限です。original interactionのlifetime過去のfollow-up message editsをrate-limitします。Botは `Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT` 経由でenforceします。`/threaddl` はunaffectedです。thread placeholdersが `editMessage` 経由で編集されるため、そのwindowにboundされません。
