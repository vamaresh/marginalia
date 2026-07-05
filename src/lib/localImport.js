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

function baseSection(name) {
  return sectionNameFromFile(name);
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

  if (!jsonFiles.length && !oneFiles.length) {
    throw new Error("Pick a .json export or one or more .one section files.");
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
