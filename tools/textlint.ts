import {
  createLinter,
  loadTextlintrc,
  loadLinterFormatter,
} from "npm:textlint";
import _1 from "npm:textlint-plugin-jsx";
import _2 from "npm:textlint-rule-preset-ja-spacing";
import _3 from "npm:textlint-rule-preset-ja-technical-writing";

const descriptor = await loadTextlintrc();
const engine = createLinter({ descriptor });
const results = await engine.lintFiles(Deno.args);
const formatter = await loadLinterFormatter({ formatterName: "stylish" });
const output = formatter.format(results);
if (output.length > 0) console.log(output);
