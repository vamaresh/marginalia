#!/usr/bin/env node
/*
 * Extract your local OneNote notebooks into a JSON file that Marginalia can import,
 * without any Microsoft account or Azure setup.
 *
 * Usage:
 *   node scripts/extract-onenote.mjs [outputFile] [--dir <oneNoteFolder>]
 *
 * By default it auto-locates OneNote's on-disk data (macOS and Windows), picks the
 * most recent backup of each section, extracts the readable text, and writes
 * `marginalia-onenote.json` (or the path you pass). Import that file in the app via
 * "Sync OneNote" -> "Sync from this computer".
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseOneSection } from "../src/lib/oneParser.js";

const NB_COLORS = ["#5B4570", "#2B5D5A", "#8A6D22", "#A8862E"];

function candidateDirs() {
  const home = os.homedir();
  return [
    // macOS OneNote
    path.join(
      home,
      "Library/Containers/com.microsoft.onenote.mac/Data/Library/Application Support/Microsoft User Data/OneNote/15.0/Back up"
    ),
    // Windows OneNote (classic) default backup location
    path.join(home, "AppData/Local/Microsoft/OneNote/16.0/Backup"),
    path.join(home, "AppData/Local/Microsoft/OneNote/15.0/Backup"),
    // OneNote UWP cache is not file-based; backups are the reliable source.
  ];
}

function findOneFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "OneNote_RecycleBin") continue;
        walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".one")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

// "Sermon Notes.one (On 16-08-2025).one" -> base "Sermon Notes"
function baseSection(file) {
  return path
    .basename(file)
    .replace(/\.one(\s*\(On[^)]*\))?\.one$/i, "")
    .replace(/\.one$/i, "")
    .trim();
}

function notebookName(file, rootDir) {
  const rel = path.relative(rootDir, file);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : "OneNote";
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function run() {
  const args = process.argv.slice(2);
  let outFile = "marginalia-onenote.json";
  let forcedDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir") forcedDir = args[++i];
    else if (!args[i].startsWith("--")) outFile = args[i];
  }

  const dirs = forcedDir ? [forcedDir] : candidateDirs();
  const rootDir = dirs.find((d) => fs.existsSync(d));
  if (!rootDir) {
    console.error("Could not find OneNote data. Looked in:\n  " + dirs.join("\n  "));
    console.error("Pass the folder explicitly with --dir <path>.");
    process.exit(1);
  }
  console.log("Reading OneNote data from:\n  " + rootDir + "\n");

  const files = findOneFiles(rootDir);
  if (!files.length) {
    console.error("No .one files found under that folder.");
    process.exit(1);
  }

  // Keep only the newest file per (notebook, section) to avoid backup duplicates.
  const latest = new Map();
  for (const file of files) {
    const nb = notebookName(file, rootDir);
    const sec = baseSection(file);
    const key = `${nb}///${sec}`;
    const mtime = fs.statSync(file).mtimeMs;
    const prev = latest.get(key);
    if (!prev || mtime > prev.mtime) latest.set(key, { file, nb, sec, mtime });
  }

  const notebooks = new Map();
  for (const { file, nb, sec, mtime } of latest.values()) {
    const bytes = new Uint8Array(fs.readFileSync(file));
    const { paragraphs } = parseOneSection(bytes);
    if (!paragraphs.length) continue;

    const edited = new Date(mtime).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (!notebooks.has(nb)) notebooks.set(nb, []);
    notebooks.get(nb).push({
      id: `local-sec-${slug(nb)}-${slug(sec)}`,
      name: sec,
      pages: [
        {
          id: `local-${slug(nb)}-${slug(sec)}`,
          title: sec,
          edited,
          content: paragraphs,
        },
      ],
    });
    console.log(`  ${nb} / ${sec}: ${paragraphs.length} paragraphs`);
  }

  const result = [...notebooks.entries()].map(([name, sections], i) => ({
    id: `local-nb-${slug(name)}`,
    name,
    color: NB_COLORS[i % NB_COLORS.length],
    synced: true,
    sections: sections.sort((a, b) => a.name.localeCompare(b.name)),
  }));

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  const totalPages = result.reduce(
    (s, nb) => s + nb.sections.reduce((p, sec) => p + sec.pages.length, 0),
    0
  );
  console.log(
    `\nWrote ${result.length} notebook(s), ${totalPages} page(s) to ${path.resolve(outFile)}`
  );
  console.log('Now open the app -> "Sync OneNote" -> "Sync from this computer" and pick that file.');
}

run();
