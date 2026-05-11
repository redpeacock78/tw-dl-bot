# コーディングガイドライン

> English: [../coding-guidelines.md](../coding-guidelines.md)

本ドキュメントは、**tw-dl-bot** の `src/` ツリーで使用する規約を成文化しています。
すべてのルールはオリジナル作成者のパターンから導出されました。チームによる追加は、例外なくこれらの規約に従う必要があります。

---

## 目次

1. [インポート & エイリアス](#1-インポート--エイリアス)
2. [関数定義](#2-関数定義)
3. [関数型スタイル](#3-関数型スタイル)
4. [定数](#4-定数)
5. [JSDoc](#5-jsdoc)
6. [ファイル & ディレクトリレイアウト](#6-ファイル--ディレクトリレイアウト)
7. [命名規則](#7-命名規則)
8. [テスト](#8-テスト)
9. [エラーハンドリング](#9-エラーハンドリング)
10. [コメント](#10-コメント)

---

## 1. インポート & エイリアス

### 理由

相対パス（`../../libs/constants.ts`）は脆弱です。ディレクトリ名変更によってサイレントに破断します。
`import_map.json` エイリアスはすべてのファイルを物理ディレクトリツリーから分離します。

### ルール

- **`src/` 内で相対 `../` インポートを使用しない。** `import_map.json` で定義されたエイリアスを使用してください。
- **Barrel ファイル（index.ts）は、任意のディレクトリの正規のインポート対象です。** Barrel使用時に循環初期化が発生する `type` インポートのみ例外です。その場合は個別のリーフファイルをインポートしてください。例として `@libs` Barrel経由のファイル内の `@libs/constants.ts` リーフが該当します。
- **インポート順序** — ローカルプロジェクトエイリアスの後に外部ライブラリ。各グループ内で順序は**アルファベット順**です：
  1. ローカルエイリアス — `@bot/`、`@libs`、`@router/`、`@utils/`
  2. 外部ライブラリ — `discordeno`、`functional`、`hono`、`@std/...`
> **注記：** オリジナルコードベースには、外部インポートを最初に配置しているファイルがあります
> （例：`callback.ts`、`interactionCreate.ts`）。上記の順序は、メッセージビルダーと
> コールバック関数ファイル内の dominant パターンを反映したもので、
> すべての新規コードの target 規約です。

### 例

```ts
// ✓ local aliases first, then external
import { Constants, Contents } from "@libs";
import { SendMessages } from "@router/messages/index.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";
import { Match } from "functional";
import type { Message } from "discordeno";

// ✓ leaf alias for a type to avoid circular init
import { Constants } from "@libs/constants.ts";

// ✗ relative path
import { Constants } from "../../libs/constants.ts";

// ✗ deep leaf import when a barrel exists
import createSuccessMessage from "@libs/messages/createSuccessMessage.ts";
```

---

## 2. 関数定義

### 理由

`const` アロー関数は宣言後に再割り当てできません。バインディングが安定します。
また、型シグネチャ全体を定義サイトで表示するため、別の型アノテーションが不要です。
`function` 宣言はscopeのtopにhoistedされます。これは、スコープに表示される行の前に呼び出せることを意味します。これにより、order-dependentロジックが隠蔽され、データフロー追跡が困難になります。

### ルール

- **すべての関数に `const fn = (...): ReturnType => { ... }` を使用します。** エクスポート有無を問わず。
- **`function` 宣言は禁止です。** 内部ヘルパーを含めて、すべてを `const` arrowで記述してください。
> **既知の例外（Phase B）：** `src/router/messages/successMessage.ts` は現在
> `async function editThreadMessageWithFiles(...)` を含みます — このガイドラインが制定される前の
> team-added `function` 宣言。Phase B refactor で `const` arrow に変換されます。
- **Generic 関数** は `const` にinline型パラメータを使用します。記述例は `const fn = <T extends string>(...): Promise<Response> => { ... }` です。
- **Default エクスポート** は `export default identifierName` を使用します（`export default function` やanonymous arrowではなく）。
- **非同期関数** は戻り値型を明示的にアノテートします：`const fn = async (): Promise<void> => { ... }`。

### 例

```ts
// ✓ const arrow — public
export const registerCommands = async (bot: Bot): Promise<void> => { ... };

// ✓ const arrow — private helper
const handleSingleSuccess = async <T extends string>(
  infoObject: InfoObject<T>,
  spoiler: boolean,
  useThread: boolean,
): Promise<Response> => { ... };

// ✓ default export
const callbackSuccessFunctions = { ... };
export default callbackSuccessFunctions;

// ✗ function declaration
function handleSingleSuccess(...) { ... }

// ✗ anonymous default export
export default async function () { ... }
```

---

## 3. 関数型スタイル

### 理由

Pattern matching（`Match`）と関数型conditional（`If`）はexhaustiveなtype-safe branchesを生成します。
これらは `if/else` チェーンがsilentにmissするunhandled caseの可能性を排除します。

### ルール

- **`if/else` branching を置き換えてください。** `Match(...).with(...).exhaustive()` または `.otherwise()` を使います。いずれも `ts-pattern` 由来で、`functional` エイリアス経由で参照します。
- **Union 型をカバーする `Match` では必ず `.exhaustive()` を呼び出します。** fallback値が必要な場合は `.otherwise()` を呼び出します。
- **単純な非同期 conditional には** `expressionify` の `If(condition, asyncFn).else(asyncFn)` を使用してください。これは `functional` 経由でも参照できます。
- **エラーハンドリングパイプラインでは** `fp-ts` の `TaskEither.tryCatch / Either.isRight / Function.pipe` を使用してください。これらも `functional` 経由で参照できます。
- **fp-ts 型エイリアス shorthand** は **ファイルスコープで**ファイル内の説明コメント付きで `type` エイリアスとして許可されています。例として `O<A>` for `Option.Option<A>` や `E<E, A>` for `Either.Either<E, A>` が挙げられます。

### 例

```ts
// ✓ exhaustive Match
return Match(isEditOriginalMessage)
  .with(true, async (): Promise<Message> => { ... })
  .with(false, async (): Promise<Message> => { ... })
  .exhaustive();

// ✓ If/else for simple async branch
return If(urls.every(isUrl), async () => { ... }).else(async () => { ... });

// ✓ fp-ts shorthand with type alias
type O<A> = Option.Option<A>;   // shorthand — Option.Option<A>
type E<Err, A> = Either.Either<Err, A>;

// ✗ if/else used for a branch that Match could express
if (isEditOriginalMessage) { ... } else { ... }
```

---

## 4. 定数

### 理由

Inlineのstring/number literalはgrepで見えず、タイプミスしやすく、安全にrenameできません。
単一の `Constants` オブジェクトはコードベースが気にかけるすべての値に対して1つのauthoritative locationを提供します。

### ルール

- **inline literal の禁止。** 既存する（または属する）値に対しては、inline stringやnumber literalを使用しないでください。対象例はHTTP status codes、command-type strings、Discord API paths、embed colours、ファイルprefixです。
- **ドット記号でのアクセスのみ。** `Constants` をdestructureしないでください。
- **モジュールレベルの `const` に抽出。** 同じ `Constants.*` 式がファイル内に複数回出現する場合の対処です。例として `const noContent = Constants.HttpStatus.NO_CONTENT;` のように書きます。
- **新しい値を `Constants` に追加。** 使用する前に追加してください。その際オブジェクトを `as const satisfies Readonly<Record<string, unknown>>` で型付けしたままにしてください。
- **Nested structure は問題ありません。** relatedな値をnamespaceの下でグループ化してください。記述例は `Constants.Message.Color.SUCCESS` や `Constants.HttpStatus.BAD_REQUEST` です。

### 例

```ts
// ✓ reference via Constants
const noContent = Constants.HttpStatus.NO_CONTENT;
return infoObject.c.body(null, { status: noContent });

// ✓ new constant added to constants.ts
DISCORD_API_BASE: "https://discord.com/api/v10",

// ✗ inline literal
return infoObject.c.body(null, { status: 204 });

// ✗ destructured
const { NO_CONTENT } = Constants.HttpStatus;

// ✗ URL hardcoded in source
const url = `https://discord.com/api/v10/channels/${id}/messages/${mid}`;
```

---

## 5. JSDoc

### 理由

JSDocコメントはすべてのTypeScript awareエディターでhover時にsurfacedされます。
`@param` に型を含めることで、エディターは呼び出しサイトでfull signatureを表示できます。

### ルール

- **すべてのエクスポート関数に JSDoc ブロックが必要です**（`/** ... */`）。
- **形式**（順序、説明とタグ間のblank lineで分離）：
  1. 散文的説明 — 関数の*何を*するかを説明し、non-obvious関数の場合、*なぜ*その方法で構造化されているかを説明してください。
  2. `@param {Type} name - Description.`
  3. `@return {Type} Description.`
  4. `@throws {Error} Description.`（関数が明示的にthrowする場合）
- **TypeScript 型を `@param {Type}` に含めてください。** エディターは呼び出しサイトが型contextを持たないときでもhoverで表示します。
- **Internal helpers**（モジュールのBarrelからexportedされていない）はJSDocを省略できます。*ただし*non-obviousロジックまたはworkaroundを含む場合、*なぜ*を説明するブロックコメントが必要です。

### 例

```ts
// ✓ complete JSDoc on exported function
/**
 * Asynchronously fetches a single file's content and metadata.
 *
 * @param {BodyDataObject | null} body - The callback body containing file and name fields.
 * @return {Promise<SingleFileContent>} Resolves with the file blob and its display name.
 * @throws {Error} When `body` is null or the file/name fields are missing.
 */
export const singleFileContent = async (body: BodyDataObject | null): Promise<SingleFileContent> => { ... };

// ✓ internal helper with explanatory comment (no @param/@return needed)
/**
 * Edits a thread placeholder via direct fetch() because discordeno v18's
 * createRequestBody uses `file${N}` part names while Discord PATCH requires
 * `files[N]` bracket notation — a mismatch that causes 4xx responses.
 */
const editThreadMessageWithFiles = async (...): Promise<Message> => { ... };

// ✗ missing JSDoc on exported function
export const registerCommands = async (bot: Bot): Promise<void> => { ... };

// ✗ JSDoc without type in @param
/**
 * @param body - The callback body.
 */
```

---

## 6. ファイル & ディレクトリレイアウト

### 理由

Barrelファイル（`index.ts`）は安定したpublic API surfaceを作成します。
外部コードは `{ Messages }` をインポートし、internal renameからshieldedされます。

### ルール

- **複数のモジュールを含む `src/` subdirectory にはすべて `index.ts` が必要です** これはpublic exportsをnamed objectに集約します：
  `export const Messages = { createSuccessMessage, createErrorMessage, ... };`
- **型は `types/` subdirectory に存在します** 。TypeScript `namespace` ブロックで構成されます。
- **ファイルあたり 1 つの concern** — メッセージビルダー、content extractor、コールバックハンドラー、utility関数はそれぞれseparateファイルに存在します。
- **concerns を cross しないでください** — 例：メッセージビルダーは `@router/` からimportしてはいけません。router関数は `@bot/` からimportしてはいけません。

### 例

```text
src/
  libs/
    index.ts              ← re-exports Contents, Messages, Constants, Custom, …
    constants.ts
    custom.ts
    contents/
      index.ts            ← export const Contents = { singleFileContent, multiFilesContent }
      singleFileContent.ts
      multiFilesContent.ts
    messages/
      index.ts            ← export const Messages = { createSuccessMessage, … }
      createSuccessMessage.ts
      …
  router/
    types/
      callbackTypes.ts    ← namespace CallbackTypes { namespace Functions { … } }
      createMessageTypes.ts
```

---

## 7. 命名規則

### 理由

一貫した命名は認知負荷を低減し、grepを信頼できるものにします。

### ルール

| Kind | Convention | Example |
|---|---|---|
| 変数 & 関数 | `camelCase` | `runNumber`、`handleSingleSuccess` |
| エクスポート識別子 | `camelCase` | `registerCommands`、`webhook` |
| 型エイリアス | `PascalCase` | `SuccessMessageInfo`、`InfoObject<T>` |
| Generic 型パラメータ | 単一の大文字 | `T`、`A`、`E` |
| Boolean パラメータ | `is`/`has` prefix なし — intent 名を使用 | `spoiler`、`useThread`（`isSpoiler` ではなく）|
| `Constants` 内の定数 | nested objects 内の leaf 値に対して `SCREAMING_SNAKE_CASE` | `NO_CONTENT`、`SUCCESS` |
| `Constants` 内の Namespace キー | `PascalCase` | `HttpStatus`、`CallbackObject` |

- **`snake_case` は TypeScript source で禁止です。** Discord JSON payloads内のみで出現します。
- **繰り返される `Constants.*` アクセスを extract してください** 。関数またはモジュールのtopで `const` に：
  ```ts
  const noContent = Constants.HttpStatus.NO_CONTENT;
  const serverError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;
  ```

---

## 8. テスト

### 理由

Sub-steps（`t.step`）は関連assertionを1つのnamed suiteの下でグループ化します。失敗はself-describingになります。
Inline state（shared fixtureなし）はtest-order couplingを防止します。

### ルール

- **Top-level structure**：`Deno.test("suite name", async (t) => { ... })` を使用します。内部に1つ以上の `await t.step("case description", async () => { ... })` を配置します。
- **Assertion**：`@std/assert` からの `assertEquals()` のみ。
  `assertStrictEquals`、`assert`、またはNode-style matchersを使用しないでください。
- **Spies & stubs**：`@std/testing/mock` からの `stub()` / `spy()` / `assertSpyCalls()`。
  `finally` ブロック内で常にrestoreしてください。
- **Fixture data は inline です。** 各 `t.step` 内 — shared setup関数またはfixtureファイルはありません。
  Helper factories（例：`makeBody()`）をtestファイルのtopで定義することは、repetitionを削減する場合に受け入れ可能です。ただし、shared mutable stateをcarryしてはいけません。
- **各 step は完全に independent です。** step間でshared stateはありません。
- **Test ファイル location は source をミラーします**。例として `tests/router/messages/successMessage.test.ts` は `src/router/messages/successMessage.ts` をテストします。

### 例

```ts
// ✓ correct structure
Deno.test("callbackSuccessFunctions — handleSingleSuccess", async (t) => {
  await t.step("dl + no shardIndex → editFollowupMessage called, returns 204", async () => {
    const editFollowup = stub(bot.helpers, "editFollowupMessage", () => Promise.resolve(fakeMsg));
    try {
      const res = await callbackSuccessFunctions.success.dl.single({ c: makeCtx() as never, body: makeBody("dl") as never });
      assertEquals(res.status, 204);
      assertSpyCalls(editFollowup, 1);
    } finally {
      editFollowup.restore();
    }
  });
});

// ✗ shared mutable state between steps
let sharedStub: Stub;
Deno.test("bad test", async (t) => {
  sharedStub = stub(...);          // leaks into next step
  await t.step("step 1", async () => { ... });
  await t.step("step 2", async () => { ... });
  sharedStub.restore();
});
```

---

## 9. エラーハンドリング

### 理由

`.then(i => i).catch(() => null)` idiomはdeliberately **graceful-degradation パターン**です。identity `.then` はresolved valueの型を保存します。`.catch` は任意のrejectionを `null` に変換します。呼び出し元は単純な `if (!value)` guardでチェックできます。
`finally` null-assignmentは、large objects（file blob、multi-file array）をpromptにreleaseします。次のGC cycleを待たずに開放されます。

### ルール

- **Graceful degradation**：失敗したPromiseがthrowの代わりに `null` を返すべき場合に `.then((i) => i).catch(() => null)` を使用します。
  identity `.then((i) => i)` はintentionalです。戻り値型inferenceをconsistentに保ち、"happy path" がpass-throughであることをsignalします。
- **リソースクリーンアップ**：関数本体を `try { ... } catch (e: unknown) { ... } finally { obj = null; }` でラップしてください。
  `finally` でlarge objectsを `null` に割り当てます。`catch` で既に `null` に設定されている場合でも。
- **エラー casting**：`(e as Error).message` — `instanceof` guardのないdirect castは受け入れ可能です。
- **Null-guard early return**：関数のtopで `null` inputsをチェックし、直ちにerror responseをreturnします：
  `if (!infoObject.body) return infoObject.c.body(null, { status: serverError });`
- **エラーメッセージ** は失敗した内容を説明するdescriptiveな英語文字列です。

### 例

```ts
// ✓ graceful degradation — identity then + null catch
let filesObject = await Contents.singleFileContent(infoObject.body)
  .then((i) => i)
  .catch(() => null);

// ✓ resource cleanup in finally
try {
  if (!filesObject) return infoObject.c.body(null, { status: serverError });
  return await SendMessages.successMessage.singleFile({ ... });
} catch (e: unknown) {
  return await SendMessages.errorMessage({ description: (e as Error).message, ... });
} finally {
  infoObject.body = null;
  filesObject = null;
}

// ✓ null-guard early return
if (!infoObject.body) return infoObject.c.body(null, { status: serverError });

// ✗ swallowing the error without null — caller cannot distinguish success from failure
const filesObject = await Contents.singleFileContent(body).catch(() => undefined);

// ✗ omitting finally cleanup
try {
  return await doWork(largeBlob);
} catch (e) {
  return errorResponse;
}
// largeBlob is never released
```

---

## 10. コメント

### 理由

コードは*何が*起こっているかを表示します。コメントは*なぜ*決定が下されたかを説明します。
単にコードをrestateするコメントはvalueを追加することなくノイズを追加します。

### ルール

- **ブロックコメント（`/* ... */`）**：architectural decisions、non-obvious constraints、またはworkaroundsの複数行説明に使用。説明するコードの直上に配置。
- **Inline コメント（`// ...`）**：edge cases、non-obvious values、important caveatsの単一行ノートに使用。関連するstatementの上（場合によってはend）に配置。
- **section-divider コメントはありません。**（`// ===`、`// ---`、`// *** SECTION ***`）。関数グループ化とファイル構造でコードをorganizeしてください。
- **`NOTE:` prefix** 既知のconstraintまたはobvious approachからのintentional deviationをフラグするコメント用：
  `// NOTE: slash command registration was moved to registerCommands.ts to keep bot.ts side-effect-free for tests.`
- **obvious なことをコメント化しないでください。** コードがself-explanatoryなら、コメントは不要です。
- **JSDoc は実装コメントとは別です。** JSDocは関数シグネチャに存在します。inlineコメントは本体内に存在します。

### 例

```ts
// ✓ block comment explaining a workaround
/*
 * discordeno v18's createRequestBody names multipart parts "file0", "file1", …
 * Discord's PATCH /messages endpoint requires "files[0]", "files[1]", …
 * Use fetch() directly to build the correct FormData.
 */
const editThreadMessageWithFiles = async (...): Promise<Message> => { ... };

// ✓ inline NOTE flagging a constraint
// NOTE: register commands before startBot so that bot.ts import is side-effect-free.
await registerCommands(bot);
await startBot(bot);

// ✓ inline comment explaining non-obvious value
attachments: files.map((f, i) => ({ id: i, filename: f.name })),
// Discord PATCH (2022+): each attachment must reference its files[N] part by zero-based id.

// ✗ comment that restates the code
// Set noContent to 204
const noContent = Constants.HttpStatus.NO_CONTENT;

// ✗ section divider
// ========== Handlers ==========
```
