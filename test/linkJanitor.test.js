import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLinks, cleanUrl, formatCsv, formatMarkdown, parseTrackingParams, sampleInput } from "../src/linkJanitor.mjs";

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

test("accepts custom tracking parameters for one-off cleanup rules", () => {
  assert.deepEqual(parseTrackingParams("?ref=share, SRC rb_clickid"), ["ref", "src", "rb_clickid"]);

  const result = cleanUrl("https://example.com/read?ref=share&SRC=email&keep=1", {
    customTrackingParams: ["ref", "src"]
  });

  assert.equal(result.clean, "https://example.com/read?keep=1");
  assert.equal(result.removedParams, 2);
});

test("removes additional marketing click identifiers conservatively", () => {
  const result = cleanUrl("https://example.com/page?mkt_tok=abc123&srsltid=xyz789&keep=1");

  assert.equal(result.ok, true);
  assert.equal(result.clean, "https://example.com/page?keep=1");
  assert.equal(result.removedParams, 2);
});

test("adds a privacy-preserving summary to markdown exports", () => {
  const analysis = analyzeLinks(sampleInput, {
    generatedAt: new Date("2026-05-22T00:00:00Z")
  });

  assert.match(
    analysis.markdown,
    /Summary: 7 found, 6 kept, 1 duplicate merged, 10 params removed, 1 warning, 2 text-only lines skipped/
  );
  assert.doesNotMatch(analysis.markdown, /Bad paste:/);
});

test("hardens csv exports against spreadsheet formulas", () => {
  const csv = formatCsv([{
    title: "=cmd|' /C calc'!A0",
    cleanUrl: "https://example.com",
    domain: "example.com",
    category: "link",
    sourceLines: [1],
    duplicates: 0,
    warnings: ["@formula"]
  }]);

  assert.match(csv, /"'=cmd\|'/);
  assert.match(csv, /"'@formula"/);
});
