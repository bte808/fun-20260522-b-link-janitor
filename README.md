# fun-20260522-b-link-janitor

Link Janitor is a local-first webpage for turning messy pasted link dumps into a clean, grouped export.

It is useful when you copy browser tabs, research notes, product links, newsletters, or chat snippets and need a tidy list without duplicate URLs or common tracking parameters.

## What it does

- Extracts `http`, `https`, and `www.` links from pasted text.
- Removes common tracking parameters such as `utm_*`, `fbclid`, `gclid`, and email campaign IDs.
- Deduplicates equivalent cleaned links and keeps source line notes.
- Groups links by domain and adds lightweight categories like docs, code, reading, watch, and shopping.
- Generates Markdown or CSV.
- Copies the result or downloads it as a local file.

## Why this is handy

Link dumps are noisy. This keeps the cleanup step private, fast, and repeatable, with no login, API key, extension, or server-side storage.

## Inspiration

This run focused on recent public interest in small, fast, single-purpose utilities: Hacker News threads about simple clipboard/link helpers, Product Hunt-style quick converters, and independent tool discussions where the value is immediate cleanup rather than a large workflow suite.

The implementation is original and dependency-free.

## Run locally

```bash
npm test
npm run check
python3 -m http.server 5182
```

Open `http://localhost:5182/index.html`.

## Core flow

1. Paste a tab dump or use the sample.
2. Toggle tracking cleanup if needed.
3. Click `Clean links`.
4. Copy or download the Markdown/CSV export.

## Validation

```bash
npm test
npm run check
curl -I http://localhost:5182/index.html
```

The app is static HTML/CSS/JS and should work offline after the files are loaded.

## Next ideas

- Import browser bookmark HTML.
- Add custom tracking-parameter presets.
- Add a saved local history using `localStorage`.
- Add domain allow/block labels for research triage.
