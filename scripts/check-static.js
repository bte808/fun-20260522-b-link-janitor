import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  html: await readFile("index.html", "utf8"),
  css: await readFile("src/styles.css", "utf8"),
  app: await readFile("src/app.js", "utf8"),
  module: await readFile("src/linkJanitor.mjs", "utf8"),
  readme: await readFile("README.md", "utf8")
};

assert.match(files.html, /<script type="module" src="\.\/src\/app\.js"><\/script>/);
assert.match(files.html, /id="rawInput"/);
assert.match(files.html, /id="exportText"/);
assert.match(files.css, /@media \(max-width: 760px\)/);
assert.match(files.app, /navigator\.clipboard/);
assert.match(files.module, /export function analyzeLinks/);
assert.match(files.readme, /fun-20260522-b-link-janitor/);

const externalRefs = files.html.match(/https?:\/\//g) || [];
assert.equal(externalRefs.length, 0, "index.html should not depend on remote assets");

console.log("Static checks passed.");
