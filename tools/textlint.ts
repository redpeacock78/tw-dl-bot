// Pin major versions so Deno resolves to a dep tree compatible with the
// Node-compat layer. Without this, an older `typed-array-byte-offset@1.0.2`
// gets cached and throws `TypeError: Cannot convert undefined or null to
// object` during init under Deno 2.x.
import {
  createLinter,
  loadTextlintrc,
  loadLinterFormatter,
} from "npm:textlint@^15";
import _1 from "npm:textlint-plugin-jsx@^1";
import _2 from "npm:textlint-rule-preset-ja-spacing@^2";
import _3 from "npm:textlint-rule-preset-ja-technical-writing@^12";

const isFix = Deno.args.includes("--fix");
const files = Deno.args.filter((a) => a !== "--fix");
const descriptor = await loadTextlintrc();
const engine = createLinter({ descriptor });
type FixResult = {
  filePath: string;
  output: string;
  messages: unknown[];
};
const results = isFix
  ? await engine.fixFiles(files)
  : await engine.lintFiles(files);
if (isFix) {
  await Promise.all(
    (results as FixResult[]).map((r) =>
      Deno.writeTextFile(r.filePath, r.output)
    ),
  );
}
const formatter = await loadLinterFormatter({ formatterName: "stylish" });
const output = formatter.format(results);
if (output.length > 0) console.log(output);
const remaining = results.reduce(
  (n: number, r: { messages: unknown[] }) => n + r.messages.length,
  0,
);
if (!isFix && remaining > 0) Deno.exit(1);
