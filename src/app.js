import { analyzeLinks, parseTrackingParams, sampleInput } from "./linkJanitor.mjs";

const elements = {
  rawInput: document.querySelector("#rawInput"),
  exportText: document.querySelector("#exportText"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  copyButton: document.querySelector("#copyButton"),
  downloadButton: document.querySelector("#downloadButton"),
  stripTracking: document.querySelector("#stripTracking"),
  customTrackingParams: document.querySelector("#customTrackingParams"),
  markdownMode: document.querySelector("#markdownMode"),
  csvMode: document.querySelector("#csvMode"),
  resultsList: document.querySelector("#resultsList"),
  statusLine: document.querySelector("#statusLine"),
  totalLinks: document.querySelector("#totalLinks span"),
  dedupedLinks: document.querySelector("#dedupedLinks span"),
  trackingRemoved: document.querySelector("#trackingRemoved span"),
  domainCount: document.querySelector("#domainCount span"),
  warningCount: document.querySelector("#warningCount")
};

let lastResult = null;
let exportMode = "markdown";

elements.rawInput.value = sampleInput;
runAnalysis();

elements.analyzeButton.addEventListener("click", runAnalysis);
elements.stripTracking.addEventListener("change", runAnalysis);
elements.customTrackingParams.addEventListener("input", runAnalysis);
elements.sampleButton.addEventListener("click", () => {
  elements.rawInput.value = sampleInput;
  runAnalysis();
});
elements.clearButton.addEventListener("click", () => {
  elements.rawInput.value = "";
  runAnalysis();
  elements.rawInput.focus();
});
elements.markdownMode.addEventListener("click", () => setMode("markdown"));
elements.csvMode.addEventListener("click", () => setMode("csv"));
elements.copyButton.addEventListener("click", copyExport);
elements.downloadButton.addEventListener("click", downloadExport);

function runAnalysis() {
  lastResult = analyzeLinks(elements.rawInput.value, {
    stripTracking: elements.stripTracking.checked,
    customTrackingParams: elements.customTrackingParams.value
  });
  render();
}

function setMode(nextMode) {
  exportMode = nextMode;
  elements.markdownMode.classList.toggle("selected", exportMode === "markdown");
  elements.csvMode.classList.toggle("selected", exportMode === "csv");
  renderExport();
}

function render() {
  elements.totalLinks.textContent = String(lastResult.stats.found);
  elements.dedupedLinks.textContent = String(lastResult.stats.kept);
  elements.trackingRemoved.textContent = String(lastResult.stats.trackingRemoved);
  elements.domainCount.textContent = String(lastResult.stats.domains);
  elements.warningCount.textContent = `${lastResult.warningCount} warnings`;
  renderExport();
  renderResults();

  const bits = [];
  bits.push(`${lastResult.stats.kept} clean links`);
  if (lastResult.stats.duplicates) bits.push(`${lastResult.stats.duplicates} duplicates merged`);
  if (lastResult.stats.invalidLines) bits.push(`${lastResult.stats.invalidLines} text-only lines skipped`);
  const customCount = parseTrackingParams(elements.customTrackingParams.value).length;
  if (elements.stripTracking.checked && customCount) bits.push(`${customCount} custom strip rules`);
  elements.statusLine.textContent = bits.join(". ") + ".";
}

function renderExport() {
  if (!lastResult) return;
  elements.exportText.value = exportMode === "csv" ? lastResult.csv : lastResult.markdown;
}

function renderResults() {
  elements.resultsList.replaceChildren();

  if (!lastResult.items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No links found.";
    elements.resultsList.append(empty);
    return;
  }

  lastResult.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "link-card";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const link = document.createElement("a");
    link.href = item.cleanUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.cleanUrl;

    const meta = document.createElement("div");
    meta.className = "meta-row";
    addChip(meta, item.domain);
    addChip(meta, item.category);
    addChip(meta, `line ${item.sourceLines.join("/")}`);
    if (item.duplicates) addChip(meta, `${item.duplicates + 1} copies`, "duplicate");
    item.warnings.forEach((warning) => addChip(meta, warning, "warning"));

    card.append(title, link, meta);
    elements.resultsList.append(card);
  });
}

function addChip(parent, text, tone = "") {
  const chip = document.createElement("span");
  chip.className = `chip ${tone}`.trim();
  chip.textContent = text;
  parent.append(chip);
}

async function copyExport() {
  const value = elements.exportText.value;
  if (!value) {
    elements.statusLine.textContent = "Nothing to copy.";
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    elements.statusLine.textContent = "Copied clean export.";
  } catch {
    elements.exportText.select();
    document.execCommand("copy");
    elements.statusLine.textContent = "Selected export for copy.";
  }
}

function downloadExport() {
  const value = elements.exportText.value;
  const extension = exportMode === "csv" ? "csv" : "md";
  const mime = exportMode === "csv" ? "text/csv" : "text/markdown";
  const blob = new Blob([value], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clean-link-pack.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
  elements.statusLine.textContent = `Downloaded clean-link-pack.${extension}.`;
}
