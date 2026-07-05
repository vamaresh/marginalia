import { parseOneSection, sectionNameFromFile, paragraphsToPage } from "./oneParser";

const NB_COLORS = ["#5B4570", "#2B5D5A", "#8A6D22", "#A8862E"];

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Notebook folder name for a picked file, when a whole folder was selected.
function notebookFor(file) {
  const rel = file.webkitRelativePath || "";
  const parts = rel.split("/").filter(Boolean);
  // parts: [pickedFolder, maybeNotebook, ..., filename]
  if (parts.length >= 3) return parts[1];
  if (parts.length === 2) return parts[0];
  return "OneNote (local)";
}

const DOC_EXTS = [".pdf", ".docx", ".html", ".htm", ".md", ".markdown", ".txt", ".text"];
function isSupportedDoc(name) {
  const n = name.toLowerCase();
  return DOC_EXTS.some((ext) => n.endsWith(ext));
}
function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim() || "Untitled";
}

// Plain-text fallback (read-aloud, word counts) derived from imported HTML.
function htmlToText(html) {
  const paras = String(html || "")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return paras.length ? paras : ["(No readable text found.)"];
}

function escapeText(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function baseSection(name) {
  return sectionNameFromFile(name);
}

// Decide notebook + section for an exported document based on any folder structure.
function docGrouping(file) {
  const rel = file.webkitRelativePath || "";
  const parts = rel.split("/").filter(Boolean);
  if (parts.length >= 3) {
    // pickedFolder / notebook / [section?] / file
    const nb = parts[1];
    const sec = parts.length >= 4 ? parts[2] : nb;
    return { nb, sec };
  }
  if (parts.length === 2) return { nb: parts[0], sec: parts[0] };
  return { nb: "Imported notes", sec: "Imported" };
}

function normalizeNotebooks(raw) {
  if (!Array.isArray(raw)) throw new Error("JSON must be an array of notebooks.");
  return raw.map((nb, i) => ({
    id: nb.id || `local-nb-${slug(nb.name || `notebook-${i}`)}`,
    name: nb.name || `Notebook ${i + 1}`,
    color: nb.color || NB_COLORS[i % NB_COLORS.length],
    synced: true,
    sections: (nb.sections || []).map((sec, j) => ({
      id: sec.id || `local-sec-${slug(nb.name)}-${slug(sec.name || j)}`,
      name: sec.name || `Section ${j + 1}`,
      pages: (sec.pages || []).map((pg, k) => ({
        id: pg.id || `local-${slug(nb.name)}-${slug(sec.name)}-${k}`,
        title: pg.title || sec.name || "Untitled",
        edited: pg.edited || "imported from this computer",
        content: Array.isArray(pg.content) && pg.content.length ? pg.content : [pg.html ? "" : "(empty)"],
        html: pg.html,
      })),
    })),
  }));
}

/*
 * Import OneNote content from files the user picks on their own computer.
 * Accepts either:
 *   - a pre-extracted `.json` file (output of scripts/extract-onenote.mjs), or
 *   - one or more raw `.one` section files (parsed here in the browser).
 * Returns notebooks in the app's shape.
 */
export async function importLocalFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) throw new Error("No files selected.");

  const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith(".json"));
  const oneFiles = files.filter((f) => f.name.toLowerCase().endsWith(".one"));
  const docFiles = files.filter((f) => isSupportedDoc(f.name));

  if (!jsonFiles.length && !oneFiles.length && !docFiles.length) {
    throw new Error("Pick exported notes (PDF, DOCX, HTML, TXT), a .json export, or .one section files.");
  }

  const notebooks = [];

  // 1) Pre-extracted JSON exports.
  for (const jf of jsonFiles) {
    const text = await jf.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${jf.name} isn't valid JSON.`);
    }
    notebooks.push(...normalizeNotebooks(parsed));
  }

  // 2) Exported documents (PDF / DOCX / HTML / MD / TXT) — rich HTML that
  //    preserves bold, italics, lists and images.
  if (docFiles.length) {
    const { parseDocFileHtml } = await import("./importDocs");
    const byNotebook = new Map();
    for (const f of docFiles) {
      let html;
      try {
        html = await parseDocFileHtml(f);
      } catch (e) {
        html = `<p>(Couldn't read ${escapeText(f.name)}: ${escapeText(e.message)})</p>`;
      }
      const { nb, sec } = docGrouping(f);
      const title = titleFromFile(f.name);
      const edited = f.lastModified
        ? new Date(f.lastModified).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "imported from this computer";
      if (!byNotebook.has(nb)) byNotebook.set(nb, new Map());
      const sections = byNotebook.get(nb);
      if (!sections.has(sec)) sections.set(sec, []);
      sections.get(sec).push({
        id: `local-${slug(nb)}-${slug(sec)}-${slug(title)}-${sections.get(sec).length}`,
        title,
        edited,
        html,
        content: htmlToText(html),
      });
    }
    let idx = notebooks.length;
    for (const [name, sections] of byNotebook.entries()) {
      notebooks.push({
        id: `local-nb-${slug(name)}`,
        name,
        color: NB_COLORS[idx % NB_COLORS.length],
        synced: true,
        sections: [...sections.entries()].map(([secName, pages]) => ({
          id: `local-sec-${slug(name)}-${slug(secName)}`,
          name: secName,
          pages,
        })),
      });
      idx++;
    }
  }

  // 2) Raw .one files parsed in the browser, grouped by folder (if a folder was picked).
  if (oneFiles.length) {
    // Keep only the newest file per (notebook, section) to skip dated backups.
    const latest = new Map();
    for (const f of oneFiles) {
      const nb = notebookFor(f);
      const sec = baseSection(f.name);
      const key = `${nb}///${sec}`;
      const prev = latest.get(key);
      if (!prev || (f.lastModified || 0) > (prev.file.lastModified || 0)) {
        latest.set(key, { file: f, nb, sec });
      }
    }

    const byNotebook = new Map();
    for (const { file, nb, sec } of latest.values()) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { paragraphs } = parseOneSection(bytes);
      if (!paragraphs.length) continue;
      const edited = file.lastModified
        ? new Date(file.lastModified).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "imported from this computer";
      if (!byNotebook.has(nb)) byNotebook.set(nb, []);
      byNotebook.get(nb).push({
        id: `local-sec-${slug(nb)}-${slug(sec)}`,
        name: sec,
        pages: [paragraphsToPage(`local-${slug(nb)}-${slug(sec)}`, sec, paragraphs, edited)],
      });
    }

    let i = notebooks.length;
    for (const [name, sections] of byNotebook.entries()) {
      notebooks.push({
        id: `local-nb-${slug(name)}`,
        name,
        color: NB_COLORS[i % NB_COLORS.length],
        synced: true,
        sections: sections.sort((a, b) => a.name.localeCompare(b.name)),
      });
      i++;
    }
  }

  if (!notebooks.length) {
    throw new Error("No readable notes were found in the selected files.");
  }
  return notebooks;
}
