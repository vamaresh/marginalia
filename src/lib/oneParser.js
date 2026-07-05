/*
 * Minimal, dependency-free reader for Microsoft OneNote `.one` section files.
 *
 * The `.one` (MS-ONESTORE) format is a proprietary binary container, but the
 * user's actual note text is stored as readable byte runs. We extract those
 * runs, drop binary/font/markup noise, de-duplicate OneNote's many internal
 * revisions, and return clean paragraphs. This runs identically in the browser
 * (File → ArrayBuffer) and in Node (fs.readFileSync), so a note can be imported
 * locally with no Microsoft account or Azure app required.
 */

const DATE_LINE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d/;

const JUNK_PREFIX = /^(iso-8859|utf-8|Calibri|Arial|Times New Roman|Segoe|Cambria|Wingdings|MS [A-Z]|Verdana|Tahoma|Courier New|Symbol|Consolas|Georgia|@[A-Za-z]|xmlns|http:\/\/schemas|onenote:|PkQ|AAFP)/i;

function cleanLine(s) {
  return s.replace(/\s+/g, " ").trim();
}

// A run reads like real note text (not binary noise, font names, or GUIDs).
function isProseLine(s) {
  const t = s.trim();
  if (t.length < 4) return false;
  if (JUNK_PREFIX.test(t)) return false;
  if (/^\{?[0-9A-Fa-f]{8}-/.test(t)) return false; // GUID-ish
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  if (letters / t.length < 0.55) return false;
  // Must contain at least one "word" of 3+ letters.
  if (!/[a-zA-Z]{3,}/.test(t)) return false;
  // Reject lines with too many odd characters (binary leakage).
  const weird = (t.match(/[^a-zA-Z0-9\s.,:;?!'"()/\-&%$#@+*=\[\]]/g) || []).length;
  if (weird / t.length > 0.08) return false;
  const words = t.split(" ").filter((w) => /[a-zA-Z]{2,}/.test(w));
  return words.length >= 1 && (t.includes(" ") || letters >= 6);
}

/*
 * Extract printable byte runs from a .one buffer.
 * @param {Uint8Array} bytes
 */
function extractRuns(bytes, minLen = 4) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const printable = b === 0x09 || (b >= 0x20 && b <= 0x7e);
    if (printable) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      if (i - start >= minLen) runs.push(bytesToString(bytes, start, i));
      start = -1;
    }
  }
  if (start !== -1 && bytes.length - start >= minLen) {
    runs.push(bytesToString(bytes, start, bytes.length));
  }
  return runs;
}

function bytesToString(bytes, start, end) {
  let s = "";
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/*
 * Parse a .one section buffer into ordered, de-duplicated paragraphs.
 * @param {Uint8Array} bytes  Raw file bytes.
 * @returns {{ paragraphs: string[] }}
 */
export function parseOneSection(bytes) {
  const runs = extractRuns(bytes).map(cleanLine).filter(Boolean);
  const seen = new Set();
  const paragraphs = [];
  for (const line of runs) {
    if (DATE_LINE.test(line)) continue;
    if (!isProseLine(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    paragraphs.push(line);
  }
  return { paragraphs };
}

/* Turn a raw section filename into a friendly title, e.g.
   "Sermon Notes.one (On 16-08-2025).one" -> "Sermon Notes". */
export function sectionNameFromFile(filename) {
  return filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/\.one(\s*\(On[^)]*\))?\.one$/i, "")
    .replace(/\.one$/i, "")
    .trim();
}

/* Build the app's page shape from parsed paragraphs. */
export function paragraphsToPage(id, title, paragraphs, editedLabel) {
  return {
    id,
    title,
    edited: editedLabel || "imported from this computer",
    content: paragraphs.length ? paragraphs : ["(No readable text found in this section.)"],
  };
}
