> English: [../development.md](../development.md)

# Development（開発）

## Prerequisites

- [Deno](https://deno.land/) — Bot は TypeScript で書かれており、Deno 上で実行されます。正確なバージョンは `deno.json` で pin されていません。最近の安定リリースでかまいません。
- [denon](https://deno.land/x/denon) — `deno task dev` で使用。ファイルウォッチング reloads（`scripts.json`）。
- Discord application with a bot token。
- runner workflow をホストし、`repository_dispatch` events を受け付ける GitHub repository。
- repository events をディスパッチする permission を持つ GitHub Personal Access Token（PAT）（下記「GitHub token」参照）。

## Repository layout（トップレベル）

\`\`\`text
.
├── deno.json               # tasks (dev, lint, build, run, start, cache, test*)
├── scripts.json            # denon config used by \`deno task dev\`
├── import_map.json         # import map for std + third-party deps
├── src/                    # bot + router + libs + utils + main entry
├── tests/                  # Deno test suite, mirrors the src/ tree
├── tools/textlint.ts       # custom textlint runner used by \`deno task lint\`
├── docker/Dockerfile       # runner image (Ubuntu + ffmpeg + yt-dlp)
└── .github/workflows/      # build.yml (image), run.yml + run-thread.yml (downloads), test.yml (CI)
\`\`\`

## Environment variables

Bot は `Constants.SECRETS`（`src/libs/secrets.ts`）内のいずれかの変数が missing な場合、startup で fast fail します。

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Discord bot token。discordeno が gateway と REST calls を authenticate するために使用。 |
| `DISPATCH_URL` | yes | GitHub \`repository_dispatch\` endpoint の完全 URL、例：\`https://api.github.com/repos/<owner>/<repo>/dispatches\`。 |
| `GITHUB_TOKEN` | yes | \`DISPATCH_URL\` に POST する際 \`Authorization: token <...>\` として使用される PAT。 |

repository root の \`.env\` ファイルが runtime で読み込まれます（プロジェクトは \`@redpeacock78/unienv\` を使用して環境を通じて env vars を uniformly に読み込みます）。実際の secrets をコミットしないでください — \`.env\` をローカルで無視して、共有する際は placeholder values を使用。

### GitHub token scopes

\`GITHUB_TOKEN\` として使用される PAT は、target repository で \`repository_dispatch\` をトリガーするように許可される必要があります：

- **Classic PAT：** \`repo\` scope（または public repo の場合は最低限 \`public_repo\`）と \`workflow\` で十分です。
- **Fine-grained PAT：** target repository にアクセスを grant。**Contents: Read and write** と **Metadata: Read-only** を付与。dispatch endpoint は repository write access でゲートされます。

runner workflow 自体は built-in \`GITHUB_TOKEN\`（\`packages: write\` 付き）を使用して runner image を GHCR にプッシュします — これは \`build.yml\` で設定され、上記の PAT とは別です。

## Common tasks

以下のすべてのタスクは \`deno.json\` で定義されています（\`dev\` / \`lint\` は denon のために \`scripts.json\` でも mirror）。

\`\`\`bash
# Watch-and-reload development server
deno task dev

# Run the bot once (no reload)
deno task run

# Cache imports declared in import_map.json
deno task cache

# Lint TypeScript and run textlint over root files
deno task lint

# Compile a self-contained binary into ./build/main
deno task build

# Run the compiled binary
deno task start

# Run the Deno test suite under tests/
deno task test

# Run tests with file-watching reloads
deno task test:watch

# Run tests with coverage; prints a \`deno coverage\` summary
deno task test:coverage
\`\`\`

\`deno task lint\` は以下を実行：

1. すべての TypeScript sources に対して \`deno lint\` を実行。\`tools/\` ディレクトリは \`deno.json\` の \`lint.exclude\` フィールド経由で除外（textlint runner は意図的に unversioned \`npm:\` specifiers を pull）。
2. \`deno run --allow-env --allow-read --allow-sys tools/textlint.ts *\` — \`.textlintrc\` をロードし、引数として渡されたファイルを lint する custom runner。shell glob \`*\` は top-level files のみに展開。

### Tests

Deno test suite は \`tests/\` の下に住み、\`src/\` tree をミラーリング（例：\`src/bot/registerCommands.ts\` ↔ \`tests/bot/registerCommands.test.ts\`）。3 つすべての \`test*\` タスクは \`DISCORD_TOKEN\`、\`DISPATCH_URL\`、\`GITHUB_TOKEN\` に対して placeholder values を事前設定するため、transitively に \`Secrets\` をロードする modules をインポートしても missing env vars で失敗しません。tests は \`bot.helpers.*\` と \`ky\` を ファイルごとに stub（real network calls ではなく）。

### Coverage

\`\`\`bash
# Run the test suite and produce a \`coverage/\` profile
deno task test:coverage
\`\`\`

\`deno task test:coverage\` は raw profile data を \`coverage/\` に書き込み、per-file table を print、\`coverage/lcov.info\` と \`coverage/html/index.html\` を生成します。ローカルで line-level coverage を閲覧するには、HTML report を open：

\`\`\`bash
open coverage/html/index.html   # macOS
xdg-open coverage/html/index.html   # Linux
\`\`\`

CI（\`.github/workflows/test.yml\`）はさらに \`deno coverage coverage --lcov > coverage.lcov\` を実行し、結果を [`codecov/codecov-action@v5`](https://github.com/codecov/codecov-action) 経由で **Codecov** にアップロード。Configuration は [`codecov.yml`](../codecov.yml)に住んでいます：

- \`tools/\`、\`tests/\`、\`docker/\`、\`**/*.test.ts\` は無視。
- \`project\` status：\`target: auto\`、\`threshold: 1%\` — overall coverage drops を 1% より大きくフラグ。
- \`patch\` status：\`target: 70%\`、\`threshold: 1%\` — すべての PR の new/modified lines は 70% に達する必要があります。

dashboard は <https://app.codecov.io/gh/redpeacock78/tw-dl-bot> にあります。\`README.md\` のバッジは master-branch percentage をミラー。

### What runs at startup

\`src/main.ts\`：

1. \`Secrets\` をロード（missing env vars で fast fail。これは \`import\` chain 経由で implicit に起こります。\`bot.ts\` が discordeno client を構築する際に \`Secrets.DISCORD_TOKEN\` を読み込むため）。
2. \`await registerCommands(bot)\`（\`src/bot/registerCommands.ts\`）を呼び出して \`dl\`、\`dl-spoiler\`、\`threaddl\` を global slash commands として登録。これは以前は top-level \`await\` inside \`bot.ts\` でしたが、\`bot.ts\` をインポートすることが unit tests のために side-effect-free になるように extract。
3. \`startBot(bot)\` を呼び出して Discord gateway connection を開く。
4. Hono app を \`/api\` にマウントし、\`std/http/server\` から \`serve\` helper 経由で serve。
5. Bot status（\`Bot.updateRAMUsage2BotStatus\`、10 秒ごと）で periodic RAM-usage update を開始。

HTTP server はデフォルトで \`0.0.0.0:8000\` をリッスン（\`https://deno.land/std@0.193.0/http/server.ts\` からの \`serve\` が実際に使用されます — \`Deno.serve\` ではなく）。ローカルで開発する場合、このポートを public internet に公開（例えば [ngrok](https://ngrok.com/) または [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)）し、\`ENDPOINT_URL\` を GitHub Actions secrets で \`/api/callback\` の public URL に設定。

## Troubleshooting

- **\`Not all secrets are set.\`** — \`DISCORD_TOKEN\`、\`DISPATCH_URL\`、\`GITHUB_TOKEN\` の 1 つが missing または empty。
- **No interactions received** — Bot が guild に招待される際に \`applications.commands\` と \`bot\` scopes を持つことを確認。
- **\`repository_dispatch\` returns 404** — \`DISPATCH_URL\` が wrong、PAT が scope を欠落、またはワークフローファイルが matching \`on.repository_dispatch.types\` を宣言していない（\`/dl\` & \`/dl-spoiler\` 用 \`download\`、\`/threaddl\` 用 \`thread-download\`）。
- **\`/threaddl\` replies "This command must be used in a guild text channel."** — interaction が DM から来た。Threads は guild text/announcement/forum channel 内でのみ作成できます。Bot は \`startThreadWithoutMessage\` を呼び出す前に \`interaction.guildId\` をチェックしてこれを enforce。
- **Callbacks never reach the bot** — \`ENDPOINT_URL\`（GH Actions secret）は publicly reachable \`/api/callback\` を指していない。tunnel logs をチェック。
- **\`/dl\` follow-up edits stop after 15 minutes** — Discord は original interaction の lifetime 過去の follow-up message edits を rate-limit。Bot はこれを \`Constants.EDIT_FOLLOWUP_MESSAGE_TIME_LIMIT\` 経由で enforce。\`/threaddl\` は unaffected（thread placeholders は \`editMessage\` 経由で編集され、その window に bound されない）。
