import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLinks, cleanUrl, formatCsv, formatMarkdown, sampleInput } from "../src/linkJanitor.mjs";

test("removes common tracking parameters and preserves useful query values", () => {
  const result = cleanUrl("https://example.com/page?utm_source=x&color=blue&fbclid=123#part");

  assert.equal(result.ok, true);
  assert.equal(result.clean, "https://example.com/page?color=blue#part");
  assert.equal(result.removedParams, 2);
});

test("analyzes a messy link dump into deduplicated grouped output", () => {
  const result = analyzeLinks(sampleInput, {
    generatedAt: new Date("2026-05-22T00:00:00Z")
  });

  assert.equal(result.stats.found, 7);
  assert.equal(result.stats.kept, 6);
  assert.equal(result.stats.duplicates, 1);
  assert.equal(result.stats.trackingRemoved, 10);
  assert.equal(result.stats.invalidLines, 2);
  assert.ok(result.markdown.includes("## example.com"));
  assert.ok(result.markdown.includes("(2 copies)"));
});

test("exports stable markdown and csv formats", () => {
  const analysis = analyzeLinks("Docs https://docs.example.com/api?utm_campaign=x", {
    generatedAt: new Date("2026-05-22T00:00:00Z")
  });

  const markdown = formatMarkdown({
    items: analysis.items,
    domains: analysis.domains,
    generatedAt: new Date("2026-05-22T00:00:00Z")
  });
  const csv = formatCsv(analysis.items);

  assert.match(markdown, /Generated: 2026-05-22/);
  assert.match(markdown, /\[Docs\]\(https:\/\/docs.example.com\/api\)/);
  assert.equal(csv.split("\n").length, 2);
  assert.match(csv, /"docs.example.com"/);
});

test("normalizes www links before parsing", () => {
  const result = analyzeLinks("Read www.example.org/story?utm_medium=social");

  assert.equal(result.items[0].cleanUrl, "https://www.example.org/story");
  assert.equal(result.stats.trackingRemoved, 1);
});
