export const sampleInput = `Research queue:
https://www.producthunt.com/posts/quickconvert-units?utm_source=newsletter&utm_medium=email&utm_campaign=launch
Quick URL cleaner - https://github.com/sindresorhus/refined-github?utm_source=tabdump
https://news.ycombinator.com/item?id=48085993
Reading later https://example.com/field-notes/?utm_source=twitter&utm_content=card#intro
Watch: https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_campaign=share
Duplicate with trackers https://example.com/field-notes/?utm_medium=social&utm_source=x#intro
Shopping idea - https://store.example.com/lamp?color=green&fbclid=abc123
Bad paste: just some text without a URL`;

export const trackingParams = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "vero_id",
  "spm",
  "ref_src",
  "_hsenc",
  "_hsmi"
]);

const redirectHosts = [
  "google.com",
  "www.google.com",
  "l.facebook.com",
  "lm.facebook.com",
  "t.co",
  "link.zhihu.com"
];

const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

export function analyzeLinks(rawText, options = {}) {
  const settings = {
    stripTracking: options.stripTracking !== false,
    customTrackingParams: new Set(parseTrackingParams(options.customTrackingParams)),
    generatedAt: options.generatedAt || new Date()
  };
  const lines = String(rawText || "").split(/\r?\n/);
  const extracted = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const matches = line.match(urlPattern);
    if (!matches) {
      if (line.trim()) invalidLines.push({ line: index + 1, text: line.trim() });
      return;
    }

    matches.forEach((match) => {
      const parsed = cleanUrl(match, settings);
      if (!parsed.ok) {
        invalidLines.push({ line: index + 1, text: match });
        return;
      }

      const title = titleFromLine(line, match) || parsed.url.hostname;
      extracted.push({
        line: index + 1,
        originalUrl: parsed.original,
        cleanUrl: parsed.clean,
        domain: parsed.url.hostname.replace(/^www\./, ""),
        title,
        category: inferCategory(`${title} ${parsed.clean}`),
        removedParams: parsed.removedParams,
        warnings: parsed.warnings
      });
    });
  });

  const seen = new Map();
  const items = [];
  let duplicateCount = 0;

  extracted.forEach((item) => {
    const key = normalizeForDedupe(item.cleanUrl);
    if (seen.has(key)) {
      duplicateCount += 1;
      const existing = seen.get(key);
      existing.duplicates += 1;
      existing.sourceLines.push(item.line);
      existing.removedParams += item.removedParams;
      existing.warnings = unique([...existing.warnings, ...item.warnings, "duplicate"]);
      return;
    }

    const stored = {
      ...item,
      duplicates: 0,
      sourceLines: [item.line]
    };
    seen.set(key, stored);
    items.push(stored);
  });

  const domains = groupByDomain(items);
  const trackingRemoved = items.reduce((sum, item) => sum + item.removedParams, 0);
  const warnings = items.flatMap((item) => item.warnings);

  return {
    items,
    domains,
    invalidLines,
    duplicateCount,
    trackingRemoved,
    warningCount: warnings.length,
    stats: {
      found: extracted.length,
      kept: items.length,
      domains: domains.length,
      trackingRemoved,
      invalidLines: invalidLines.length,
      duplicates: duplicateCount
    },
    markdown: formatMarkdown({ items, domains, generatedAt: settings.generatedAt }),
    csv: formatCsv(items)
  };
}

export function cleanUrl(input, settings = {}) {
  const original = trimUrl(input);
  const withProtocol = original.startsWith("www.") ? `https://${original}` : original;

  try {
    let url = new URL(withProtocol);
    const warnings = [];
    const customTrackingParams = settings.customTrackingParams instanceof Set
      ? settings.customTrackingParams
      : new Set(parseTrackingParams(settings.customTrackingParams));

    const redirectCandidate = unwrapRedirect(url);
    if (redirectCandidate) {
      url = redirectCandidate;
      warnings.push("unwrapped redirect");
    }

    let removedParams = 0;
    if (settings.stripTracking !== false) {
      const params = [...url.searchParams.keys()];
      params.forEach((key) => {
        const normalizedKey = key.toLowerCase();
        if (
          trackingParams.has(normalizedKey) ||
          normalizedKey.startsWith("utm_") ||
          customTrackingParams.has(normalizedKey)
        ) {
          url.searchParams.delete(key);
          removedParams += 1;
        }
      });
    }

    if ([...url.searchParams.keys()].some((key) => ["ref", "aff", "affiliate"].includes(key.toLowerCase()))) {
      warnings.push("referral parameter kept");
    }

    if (url.search.length > 140) {
      warnings.push("long query kept");
    }

    url.hash = url.hash.trim();

    return {
      ok: true,
      original,
      clean: url.toString(),
      url,
      removedParams,
      warnings
    };
  } catch {
    return { ok: false, original };
  }
}

export function formatMarkdown(result) {
  const date = toDateStamp(result.generatedAt || new Date());
  const lines = [`# Clean Link Pack`, ``, `Generated: ${date}`, ``];

  result.domains.forEach((group) => {
    lines.push(`## ${group.domain}`);
    group.items.forEach((item) => {
      const duplicateNote = item.duplicates ? ` (${item.duplicates + 1} copies)` : "";
      const tags = [`${item.category}`, `line ${item.sourceLines.join("/")}`].join(", ");
      lines.push(`- [${escapeMarkdown(item.title)}](${item.cleanUrl}) - ${tags}${duplicateNote}`);
    });
    lines.push("");
  });

  if (result.domains.length === 0) {
    lines.push("_No links found._", "");
  }

  return lines.join("\n").trimEnd();
}

export function formatCsv(items) {
  const rows = [["title", "clean_url", "domain", "category", "source_lines", "duplicates", "warnings"]];
  items.forEach((item) => {
    rows.push([
      item.title,
      item.cleanUrl,
      item.domain,
      item.category,
      item.sourceLines.join("|"),
      String(item.duplicates),
      item.warnings.join("|")
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function parseTrackingParams(value) {
  const parts = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);

  return unique(parts
    .map((part) => String(part).trim().replace(/^[?&]+/, "").split("=")[0].toLowerCase())
    .filter((part) => /^[a-z0-9_.:-]+$/.test(part)));
}

function unwrapRedirect(url) {
  if (!redirectHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    return null;
  }

  const candidate = ["url", "u", "target", "to"].map((key) => url.searchParams.get(key)).find(Boolean);
  if (!candidate) return null;

  try {
    const decoded = decodeURIComponent(candidate);
    return new URL(decoded.startsWith("www.") ? `https://${decoded}` : decoded);
  } catch {
    return null;
  }
}

function trimUrl(input) {
  return String(input)
    .trim()
    .replace(/[),.;!?]+$/g, "");
}

function titleFromLine(line, url) {
  return line
    .replace(url, "")
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategory(text) {
  const haystack = text.toLowerCase();
  if (/(github|gitlab|repo|code|npm|package)/.test(haystack)) return "code";
  if (/(youtube|video|watch|talk|demo)/.test(haystack)) return "watch";
  if (/(shop|store|cart|buy|price|deal)/.test(haystack)) return "shopping";
  if (/(docs|guide|manual|api|reference)/.test(haystack)) return "docs";
  if (/(article|blog|read|newsletter|hacker news|producthunt)/.test(haystack)) return "reading";
  return "link";
}

function groupByDomain(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.domain)) groups.set(item.domain, []);
    groups.get(item.domain).push(item);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, groupItems]) => ({
      domain,
      items: groupItems.sort((a, b) => a.title.localeCompare(b.title))
    }));
}

function normalizeForDedupe(url) {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace(/^www\./, "");
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
  parsed.hash = "";
  return parsed.toString();
}

function unique(items) {
  return [...new Set(items)];
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\[\]]/g, "\\$&");
}

function toDateStamp(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
