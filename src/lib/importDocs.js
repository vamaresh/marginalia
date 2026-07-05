import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/*
 * Import notes the user exported from OneNote (or anywhere) as ordinary
 * documents. This gives clean, readable text — far better than scraping the
 * proprietary .one binary. Supported: PDF, DOCX, HTML, Markdown, plain text.
 */

function cleanParas(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{1,}/)
    .map((s) => s.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

async function parsePdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const paras = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    let lastY = null;
    for (const item of content.items) {
      const y = item.transform ? item.transform[5] : null;
      // New line when the vertical position shifts.
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
        if (line.trim()) paras.push(line.trim());
        line = "";
      }
      line += item.str;
      if (item.hasEOL) {
        if (line.trim()) paras.push(line.trim());
        line = "";
      }
      lastY = y;
    }
    if (line.trim()) paras.push(line.trim());
  }
  return paras.map((s) => s.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}

async function parseDocx(file) {
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return cleanParas(value);
}

async function parseHtml(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  const blocks = [];
  doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,div,blockquote,pre").forEach((el) => {
    const t = el.textContent.replace(/\s+/g, " ").trim();
    if (t) blocks.push(t);
  });
  if (!blocks.length) {
    const t = (doc.body.textContent || "").trim();
    return cleanParas(t);
  }
  return [...new Set(blocks)];
}

async function parseText(file) {
  return cleanParas(await file.text());
}

const PARSERS = [
  { test: (n) => n.endsWith(".pdf"), parse: parsePdf },
  { test: (n) => n.endsWith(".docx"), parse: parseDocx },
  { test: (n) => n.endsWith(".html") || n.endsWith(".htm"), parse: parseHtml },
  { test: (n) => n.endsWith(".md") || n.endsWith(".markdown") || n.endsWith(".txt") || n.endsWith(".text"), parse: parseText },
];

export function isSupportedDoc(name) {
  const n = name.toLowerCase();
  return PARSERS.some((p) => p.test(n));
}

/* Parse a single document file into ordered paragraphs. */
export async function parseDocFile(file) {
  const n = file.name.toLowerCase();
  const entry = PARSERS.find((p) => p.test(n));
  if (!entry) throw new Error(`Unsupported file type: ${file.name}`);
  return entry.parse(file);
}

/* Turn "Sermon Notes.pdf" -> "Sermon Notes". */
export function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim() || "Untitled";
}
