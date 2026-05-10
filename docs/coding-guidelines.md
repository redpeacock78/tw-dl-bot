# Coding Guidelines

> 日本語版: [./jp/coding-guidelines.md](./jp/coding-guidelines.md)

This document codifies the conventions used in **tw-dl-bot**'s `src/` tree.
Every rule was derived from the original author's patterns; additions by the team are expected to follow these conventions without exception.

---

## Table of Contents

1. [Imports & Aliases](#1-imports--aliases)
2. [Function Definitions](#2-function-definitions)
3. [Functional Style](#3-functional-style)
4. [Constants](#4-constants)
5. [JSDoc](#5-jsdoc)
6. [File & Directory Layout](#6-file--directory-layout)
7. [Naming Conventions](#7-naming-conventions)
8. [Tests](#8-tests)
9. [Error Handling](#9-error-handling)
10. [Comments](#10-comments)

---

## 1. Imports & Aliases

### Why

Relative paths (`../../libs/constants.ts`) are fragile — a directory rename silently breaks them.
`import_map.json` aliases decouple every file from the physical directory tree.

### Rules

- **Never use relative `../` imports** inside `src/`.  Use the aliases defined in `import_map.json`.
- **Barrel files (index.ts) are the canonical import target** for any directory that has one.
  Import the individual leaf file only when importing a `type` that would cause a circular init if the barrel were used (e.g. `@libs/constants.ts` leaf inside a file that is itself re-exported through the `@libs` barrel).
- **Import order** (one blank line between each group):
  1. External libraries — `functional`, `discordeno`, `hono`, `@std/...`
  2. Local aliases — `@bot/`, `@libs`, `@router/`, `@utils/`
- Within each group, order is **alphabetical**.

### Examples

```ts
// ✓ barrel alias
import { Messages, Constants } from "@libs";
import { Match, If } from "functional";

// ✓ leaf alias for a type to avoid circular init
import { Constants } from "@libs/constants.ts";

// ✗ relative path
import { Constants } from "../../libs/constants.ts";

// ✗ deep leaf import when a barrel exists
import createSuccessMessage from "@libs/messages/createSuccessMessage.ts";
```

---

## 2. Function Definitions

### Why

Arrow functions bound to `const` are hoisted as variable declarations and make the type signature immediately visible.
`function` declarations can be called before they are defined, which obscures data flow.

### Rules

- **Use `const fn = (...): ReturnType => { ... }` for all functions** — both exported and module-private.
- **`function` declarations are prohibited.** Use `const` arrows throughout, including internal helpers.
- **Generic functions** use an inline type parameter on the const: `const fn = <T extends string>(...): Promise<Response> => { ... }`.
- **Default exports** use `export default identifierName` (never `export default function` or an anonymous arrow).
- **Async functions** annotate the return type explicitly: `const fn = async (): Promise<void> => { ... }`.

### Examples

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

## 3. Functional Style

### Why

Pattern matching (`Match`) and functional conditionals (`If`) produce exhaustive, type-safe branches.
They eliminate the possibility of an unhandled case that `if/else` chains can silently miss.

### Rules

- **Replace `if/else` branching with `Match(...).with(...).exhaustive()` or `.otherwise()`** (from `ts-pattern` via the `functional` alias).
- **Always call `.exhaustive()`** on a `Match` whose cases cover a union type; call `.otherwise()` when a fallback value is needed.
- **For simple async conditionals** use `If(condition, asyncFn).else(asyncFn)` from `expressionify` (also in `functional`).
- **For error-handling pipelines** use `TaskEither.tryCatch / Either.isRight / Function.pipe` from `fp-ts` (also in `functional`).
- **fp-ts type alias shorthand** (`O<A>` for `Option.Option<A>`, `E<E, A>` for `Either.Either<E, A>`) is permitted **at file scope** as a `type` alias with an explanatory comment at the definition site.

### Examples

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

## 4. Constants

### Why

Inline string/number literals are invisible to grep, easy to mistype, and impossible to rename safely.
A single `Constants` object gives one authoritative location for every value the codebase cares about.

### Rules

- **No inline string or number literals** for values that already exist (or belong) in `Constants`.
  This includes HTTP status codes, command-type strings, Discord API paths, embed colours, and file prefixes.
- **Access via dot notation only** — never destructure `Constants`.
- **Extract to a module-level `const`** when the same `Constants.*` expression appears more than once in a file:
  `const noContent = Constants.HttpStatus.NO_CONTENT;`
- **Add new values to `Constants`** before using them; keep the object typed with
  `as const satisfies Readonly<Record<string, unknown>>`.
- **Nested structure is fine** — group related values under a namespace
  (`Constants.Message.Color.SUCCESS`, `Constants.HttpStatus.BAD_REQUEST`).

### Examples

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

### Why

JSDoc comments are surfaced by every TypeScript-aware editor on hover.
Including the type in `@param` lets the editor display the full signature even when the cursor is on a call site.

### Rules

- **All exported functions must have a JSDoc block** (`/** ... */`).
- **Format** (in order, separated by a blank line between description and tags):
  1. Prose description — explain *what* the function does and, for non-obvious functions, *why* it is structured that way.
  2. `@param {Type} name - Description.`
  3. `@return {Type} Description.`
  4. `@throws {Error} Description.` (when the function throws explicitly)
- **Include the TypeScript type in `@param {Type}`** — editors show it on hover even when the call site lacks type context.
- **Internal helpers** (not exported from the module's barrel) may omit JSDoc *unless* they contain non-obvious logic or a workaround, in which case a block comment explaining the *why* is required.

### Examples

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

## 6. File & Directory Layout

### Why

Barrel files (`index.ts`) create a stable public API surface.
External code imports `{ Messages }` and is shielded from internal renames.

### Rules

- **Every `src/` subdirectory that contains more than one module must have an `index.ts`** that aggregates its public exports into a named object:
  `export const Messages = { createSuccessMessage, createErrorMessage, ... };`
- **Types live in a `types/` subdirectory** and are organised with TypeScript `namespace` blocks.
- **One concern per file** — message builders, content extractors, callback handlers, and utility functions each live in separate files.
- **Do not cross concerns** — e.g. a message builder must not import from `@router/`; a router function must not import from `@bot/`.

### Examples

```
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

## 7. Naming Conventions

### Why

Consistent naming reduces cognitive load and makes grep reliable.

### Rules

| Kind | Convention | Example |
|---|---|---|
| Variables & functions | `camelCase` | `runNumber`, `handleSingleSuccess` |
| Exported identifiers | `camelCase` | `registerCommands`, `webhook` |
| Type aliases | `PascalCase` | `SuccessMessageInfo`, `InfoObject<T>` |
| Generic type params | Single uppercase letter | `T`, `A`, `E` |
| Boolean parameters | No `is`/`has` prefix — use intent name | `spoiler`, `useThread` (not `isSpoiler`) |
| Constants in `Constants` | `SCREAMING_SNAKE_CASE` for leaf values inside nested objects | `NO_CONTENT`, `SUCCESS` |
| Namespace keys in `Constants` | `PascalCase` | `HttpStatus`, `CallbackObject` |

- **`snake_case` is forbidden** in TypeScript source; it appears only inside Discord JSON payloads.
- **Extract repeated `Constants.*` access** to a `const` at the top of the function or module:
  ```ts
  const noContent = Constants.HttpStatus.NO_CONTENT;
  const serverError = Constants.HttpStatus.INTERNAL_SERVER_ERROR;
  ```

---

## 8. Tests

### Why

Sub-steps (`t.step`) group related assertions under one named suite, making failures self-describing.
Inline state (no shared fixtures) prevents test-order coupling.

### Rules

- **Top-level structure**: `Deno.test("suite name", async (t) => { ... })` with one or more `await t.step("case description", async () => { ... })` inside.
- **Assertions**: `assertEquals()` from `@std/assert` only.
  Do not use `assertStrictEquals`, `assert`, or Node-style matchers.
- **Spies & stubs**: `stub()` / `spy()` / `assertSpyCalls()` from `@std/testing/mock`.
  Always restore inside a `finally` block.
- **Fixture data is inline** within each `t.step` — no shared setup functions or fixture files.
  Helper factories (e.g. `makeBody()`) defined at the top of the test file are acceptable when they reduce repetition, but they must not carry shared mutable state.
- **Each step is fully independent** — no state shared between steps.
- **Test file location mirrors source**: `tests/router/messages/successMessage.test.ts` tests `src/router/messages/successMessage.ts`.

### Examples

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

## 9. Error Handling

### Why

The `.then(i => i).catch(() => null)` idiom is a deliberate **graceful-degradation pattern**: the identity `.then` preserves the resolved value's type while `.catch` converts any rejection into `null`, which callers can check with a simple `if (!value)` guard.
The `finally` null-assignment ensures large objects (file blobs, multi-file arrays) are released promptly rather than waiting for the next GC cycle.

### Rules

- **Graceful degradation**: use `.then((i) => i).catch(() => null)` when a failed Promise should produce `null` instead of throwing.
  The identity `.then((i) => i)` is intentional — it keeps the return type inference consistent and signals that the "happy path" is a pass-through.
- **Resource cleanup**: wrap the function body in `try { ... } catch (e: unknown) { ... } finally { obj = null; }`.
  Assign large objects to `null` in `finally`, even if they were already set to `null` inside `catch`.
- **Error casting**: `(e as Error).message` — a direct cast without an `instanceof` guard is acceptable.
- **Null-guard early return**: check for `null` inputs at the top of the function and return an error response immediately:
  `if (!infoObject.body) return infoObject.c.body(null, { status: serverError });`
- **Error messages** are descriptive English strings explaining what failed.

### Examples

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

## 10. Comments

### Why

Code shows *what* is happening; comments explain *why* a decision was made.
A comment that merely restates the code adds noise without value.

### Rules

- **Block comments (`/* ... */`)**: use for multi-line explanations of architectural decisions, non-obvious constraints, or workarounds. Place them directly above the code they describe.
- **Inline comments (`// ...`)**: use for single-line notes on edge cases, non-obvious values, or important caveats. Place them on the line *above* (or occasionally at the end of) the relevant statement.
- **No section-divider comments** (`// ===`, `// ---`, `// *** SECTION ***`). Organise code with function grouping and file structure instead.
- **`NOTE:` prefix** for comments that flag a known constraint or intentional deviation from the obvious approach:
  `// NOTE: slash command registration was moved to registerCommands.ts to keep bot.ts side-effect-free for tests.`
- **Do not comment the obvious.** If the code is self-explanatory, no comment is needed.
- **JSDoc is separate from implementation comments.** JSDoc lives at the function signature; inline comments live inside the body.

### Examples

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
