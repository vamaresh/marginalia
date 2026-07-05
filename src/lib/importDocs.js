import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/*
 * Import notes the user exported from OneNote (or anywhere) as ordinary
 * documents, preserving formatting where the source has it.
 *
 *   DOCX / HTML / Markdown -> rich HTML with bold, italics, lists AND images
 *                             (images are inlined as base64 data URIs).
 *   PDF                     -> HTML with heading, bold/italic and bullet
 *                             detection, plus any embedded images.
 *   TXT                     -> plain paragraphs.
 *
 * Each parser returns a sanitized HTML string. The caller keeps the HTML for
 * display and derives plain paragraphs (for read-aloud / word counts).
 */

/* --------------------------------------------------------------------- */
/* HTML sanitiser — keep formatting + images, drop anything executable.  */
/* --------------------------------------------------------------------- */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark", "small",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "col", "colgroup",
]);

const ALLOWED_ATTRS = {
  "*": ["style", "align", "colspan", "rowspan"],
  a: ["href", "title"],
  img: ["src", "alt", "title", "width", "height"],
};

function attrAllowed(tag, name) {
  const g = ALLOWED_ATTRS["*"];
  const t = ALLOWED_ATTRS[tag] || [];
  return g.includes(name) || t.includes(name);
}

function safeUrl(url) {
  const u = String(url || "").trim();
  return /^(https?:|mailto:|data:image\/|#|\/)/i.test(u) ? u : "";
}

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(
    `<div id="__root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("__root");
  if (!root) return "";

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap unknown tags but keep their text/children.
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        return;
      }
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || !attrAllowed(tag, name)) {
          child.removeAttribute(attr.name);
        }
      });
      if (tag === "a") {
        const href = safeUrl(child.getAttribute("href"));
        if (href) {
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        } else {
          child.removeAttribute("href");
        }
      }
      if (tag === "img") {
        const src = safeUrl(child.getAttribute("src"));
        if (!src) {
          child.remove();
          return;
        }
        child.setAttribute("src", src);
        child.setAttribute("loading", "lazy");
        child.setAttribute(
          "style",
          `${child.getAttribute("style") || ""};max-width:100%;height:auto`
        );
      }
      walk(child);
    });
  };
  walk(root);
  return root.innerHTML;
}

/* --------------------------------------------------------------------- */
/* Small helpers                                                         */
/* --------------------------------------------------------------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/* --------------------------------------------------------------------- */
/* DOCX — mammoth keeps bold/italic/lists and inlines images as base64.  */
/* --------------------------------------------------------------------- */

async function parseDocx(file) {
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        return { src: `data:${image.contentType};base64,${base64}` };
      }),
    }
  );
  return sanitizeHtml(value);
}

/* --------------------------------------------------------------------- */
/* HTML — keep the document's own formatting and images.                 */
/* --------------------------------------------------------------------- */

async function parseHtml(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "text/html");
  doc.querySelectorAll("script,style,noscript,head,meta,link").forEach((n) => n.remove());
  const body = doc.body ? doc.body.innerHTML : text;
  return sanitizeHtml(body) || textToHtml(doc.body ? doc.body.textContent : text);
}

/* --------------------------------------------------------------------- */
/* Markdown — light converter (bold, italic, headings, lists, images).   */
/* --------------------------------------------------------------------- */

function inlineMd(s) {
  let out = escapeHtml(s);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt, src) => {
    const u = safeUrl(src);
    return u ? `<img src="${u}" alt="${escapeHtml(alt)}">` : escapeHtml(alt);
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, txt, href) => {
    const u = safeUrl(href);
    return u ? `<a href="${u}">${txt}</a>` : txt;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let list = null; // "ul" | "ol"
  let para = [];
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inlineMd).join("<br>")}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      const lvl = h[1].length;
      html.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`);
    } else if (ul) {
      flushPara();
      if (list !== "ul") {
        closeList();
        list = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMd(ul[1])}</li>`);
    } else if (ol) {
      flushPara();
      if (list !== "ol") {
        closeList();
        list = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMd(ol[1])}</li>`);
    } else if (!line.trim()) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return html.join("");
}

async function parseMarkdown(file) {
  return sanitizeHtml(markdownToHtml(await file.text()));
}

async function parseText(file) {
  return textToHtml(await file.text());
}

/* --------------------------------------------------------------------- */
/* PDF — reconstruct headings, bold/italic runs, bullet lists + images.  */
/* --------------------------------------------------------------------- */

const BULLET_RE = /^[\u2022\u25AA\u25CF\u25E6\u2023\u2043\u00B7\u2219*-]\s*/;
const TRAILING_BULLET_RE = /[\u2022\u25AA\u25CF\u25E6\u00B7]\s*$/;

// Best-effort read of the real (embedded) font name so we can spot bold/italic.
function fontNameFor(page, styles, fontId) {
  try {
    if (page.commonObjs && page.commonObjs.has(fontId)) {
      const f = page.commonObjs.get(fontId);
      if (f && f.name) return f.name;
    }
  } catch {
    /* ignore */
  }
  const s = styles && styles[fontId];
  return (s && s.fontFamily) || fontId || "";
}

function styleFlags(name) {
  const n = String(name).toLowerCase();
  return {
    bold: /bold|black|heavy|semibold|demibold/.test(n),
    italic: /italic|oblique/.test(n),
  };
}

function runsToHtml(runs) {
  return runs
    .map((r) => {
      let t = escapeHtml(r.str);
      if (r.italic) t = `<em>${t}</em>`;
      if (r.bold) t = `<strong>${t}</strong>`;
      return t;
    })
    .join("");
}

function imageToDataUrl(img) {
  if (!img || !img.width || !img.height || !img.data) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    const { data, width, height } = img;
    const out = ctx.createImageData(width, height);
    const n = width * height;
    if (data.length === n * 4) {
      out.data.set(data);
    } else if (data.length === n * 3) {
      for (let i = 0, j = 0; i < n; i++) {
        out.data[j++] = data[i * 3];
        out.data[j++] = data[i * 3 + 1];
        out.data[j++] = data[i * 3 + 2];
        out.data[j++] = 255;
      }
    } else if (data.length === n) {
      for (let i = 0, j = 0; i < n; i++) {
        const v = data[i];
        out.data[j++] = v;
        out.data[j++] = v;
        out.data[j++] = v;
        out.data[j++] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Pull embedded images out of a page, keyed by their vertical position.
async function pdfPageImages(page) {
  const images = [];
  try {
    const ops = await page.getOperatorList();
    const { OPS } = pdfjs;
    let transform = null;
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === OPS.transform) {
        transform = args;
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const name = args[0];
        const img = await new Promise((resolve) => {
          try {
            if (fn === OPS.paintInlineImageXObject && name && typeof name === "object") {
              resolve(name);
            } else if (typeof name === "string" && page.objs.has && page.objs.has(name)) {
              page.objs.get(name, resolve);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
        const dataUrl = imageToDataUrl(img);
        if (dataUrl) images.push({ y: transform ? transform[5] : 0, dataUrl });
      }
    }
  } catch {
    /* image extraction is best-effort */
  }
  return images;
}

async function parsePdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  const allLines = []; // { runs, size, y, page, image }
  const sizes = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const images = await pdfPageImages(page);

    let curY = null;
    let runs = [];
    let lineSize = 0;
    const flush = () => {
      if (runs.length) {
        const text = runs.map((r) => r.str).join("");
        if (text.trim()) {
          allLines.push({ runs: mergeRuns(runs), size: lineSize, y: curY, page: p });
        }
      }
      runs = [];
      lineSize = 0;
    };
    for (const item of content.items) {
      const y = item.transform ? item.transform[5] : null;
      const scale = item.transform
        ? Math.hypot(item.transform[0], item.transform[1])
        : item.height || 10;
      if (curY !== null && y !== null && Math.abs(y - curY) > (scale || 10) * 0.6) {
        flush();
      }
      const fname = fontNameFor(page, content.styles, item.fontName);
      const { bold, italic } = styleFlags(fname);
      runs.push({ str: item.str, bold, italic });
      lineSize = Math.max(lineSize, scale || item.height || 10);
      sizes.push(scale || item.height || 10);
      curY = y;
      if (item.hasEOL) flush();
    }
    flush();

    for (const im of images) {
      allLines.push({ image: im.dataUrl, y: im.y, size: 0, page: p, runs: [] });
    }
  }

  // Sort by page, then descending y so images land near their surrounding text.
  allLines.sort((a, b) => a.page - b.page || b.y - a.y);

  const bodySize = medianSize(sizes) || 12;
  return buildPdfHtml(allLines, bodySize);
}

function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic) {
      last.str += r.str;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

function medianSize(sizes) {
  if (!sizes.length) return 0;
  const s = [...sizes].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function stripBullet(runs) {
  const copy = runs.map((r) => ({ ...r }));
  if (copy.length) copy[0].str = copy[0].str.replace(BULLET_RE, "");
  const last = copy[copy.length - 1];
  if (last) last.str = last.str.replace(TRAILING_BULLET_RE, "");
  return copy.filter((r) => r.str.length);
}

function buildPdfHtml(lines, bodySize) {
  const html = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.image) {
      closeList();
      html.push(`<p><img src="${line.image}" alt="" style="max-width:100%;height:auto"></p>`);
      continue;
    }
    const text = line.runs.map((r) => r.str).join("").trim();
    if (!text) continue;

    const isBullet = BULLET_RE.test(text) || TRAILING_BULLET_RE.test(text);
    if (isBullet) {
      const runs = stripBullet(line.runs);
      if (!runs.length) continue;
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${runsToHtml(runs)}</li>`);
      continue;
    }
    closeList();

    const ratio = line.size / bodySize;
    const allBold = line.runs.every((r) => r.bold) && line.runs.some((r) => r.str.trim());
    if (ratio >= 1.5) {
      html.push(`<h1>${runsToHtml(line.runs)}</h1>`);
    } else if (ratio >= 1.25) {
      html.push(`<h2>${runsToHtml(line.runs)}</h2>`);
    } else if (ratio >= 1.1 || allBold) {
      html.push(`<h3>${runsToHtml(line.runs)}</h3>`);
    } else {
      html.push(`<p>${runsToHtml(line.runs)}</p>`);
    }
  }
  closeList();
  return sanitizeHtml(html.join(""));
}

/* --------------------------------------------------------------------- */
/* Public API                                                            */
/* --------------------------------------------------------------------- */

const PARSERS = [
  { test: (n) => n.endsWith(".pdf"), parse: parsePdf },
  { test: (n) => n.endsWith(".docx"), parse: parseDocx },
  { test: (n) => n.endsWith(".html") || n.endsWith(".htm"), parse: parseHtml },
  { test: (n) => n.endsWith(".md") || n.endsWith(".markdown"), parse: parseMarkdown },
  { test: (n) => n.endsWith(".txt") || n.endsWith(".text"), parse: parseText },
];

export function isSupportedDoc(name) {
  const n = name.toLowerCase();
  return PARSERS.some((p) => p.test(n));
}

/* Parse a document into sanitized HTML that preserves its formatting. */
export async function parseDocFileHtml(file) {
  const n = file.name.toLowerCase();
  const entry = PARSERS.find((p) => p.test(n));
  if (!entry) throw new Error(`Unsupported file type: ${file.name}`);
  const html = await entry.parse(file);
  return html && html.trim() ? html : "<p>(No readable content found.)</p>";
}

/* Turn "Sermon Notes.pdf" -> "Sermon Notes". */
export function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim() || "Untitled";
}
