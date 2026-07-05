# Marginalia

A OneNote-alternative reading app: Kindle-style reading, real text-to-speech,
AI-generated two-host podcasts from your notes, and sermon-specific intelligence
(related sermons, illustration suggestions, repeated-illustration warnings).

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel: **New Project** → import that repository. Vercel auto-detects
   the Vite build (`npm run build`, output `dist`) — no config needed.
3. Before your first deploy (or right after), go to
   **Project Settings → Environment Variables** and add:
   - `OPENAI_API_KEY` = your OpenAI API key (from platform.openai.com/api-keys)

   This key powers the `/api/chat` serverless function, which the app calls
   for **Turn into podcast** and **Sermon insights**. It never reaches the
   browser — only your server-side function sees it.
4. Deploy. Every push to your main branch will auto-redeploy.

## What's real vs. simulated

- **Reading, theming, editing, formatting, search** — fully real, runs entirely
  in the browser.
- **Listen (text-to-speech)** — real, uses the browser's built-in Web Speech
  API. Voice quality depends on the device/browser; works best in Chrome or
  Edge on desktop.
- **Turn into podcast / Sermon insights** — real OpenAI API calls via the
  `/api/chat` serverless function. Needs `OPENAI_API_KEY` set as above.
- **Sync OneNote** — **real**, with a few ways to import (nothing is ever
  modified in OneNote):
  1. **Export → import** (recommended, cleanest text) — export your notes from
     OneNote and open the files in the app. See "Import exported notes" below.
  2. **Cloud sign-in** — signs in with Microsoft (MSAL.js) and pulls your
     notebooks via the Microsoft Graph OneNote API. See "Cloud OneNote sync".
  3. **Direct local files** — advanced; reads OneNote's on-disk `.one` backups
     (text-only, best-effort). See "Direct local files".
- **Edit structure** — click **Edit** in the sidebar to rename, add or delete
  notebooks, sections and pages (and rename page titles). Everything you import
  or edit is saved in your browser and restored on reload.

## Import exported notes (recommended — no Azure)

This gives the cleanest text and needs no Microsoft account.

1. In OneNote, open a page/section and choose **File → Print → Save as PDF**
   (OneNote for Mac), or **File → Export** (Windows). Repeat for the notes you
   want. You can also use DOCX, HTML, Markdown or plain-text exports.
2. In the app: **Sync OneNote → Choose exported files**, then select all the
   files at once.
3. Each file becomes a page. Use **Edit** in the sidebar to rename pages,
   group them into sections/notebooks, and delete anything you don't want.

Supported formats: **PDF, DOCX, HTML/HTM, Markdown (.md), and text (.txt)**.
Parsing happens entirely in your browser.

## Direct local files (advanced)

You can also point the app straight at OneNote's on-disk data. Either run:

```bash
npm run onenote:local        # writes marginalia-onenote.json
```

which auto-locates OneNote's backups (macOS and Windows) and extracts the text,
then import that JSON via **Choose exported files**; or select raw `.one` files
directly in the app. On macOS the backups live under
`~/Library/Containers/com.microsoft.onenote.mac/Data/Library/Application Support/Microsoft User Data/OneNote/15.0/Back up`
(press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> in the file dialog to show
hidden folders); on Windows, under
`%LOCALAPPDATA%\Microsoft\OneNote\16.0\Backup`.

> The `.one` format is proprietary binary, so this path extracts readable text
> only (no per-page split, formatting or images) and can include some noise —
> prefer the PDF export path above for clean results.

## Cloud OneNote sync (Microsoft Graph)

Cloud sync uses a delegated Microsoft Graph connection. To turn it on:

1. In the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** →
   **App registrations** → **New registration**.
   - Supported account types: *Accounts in any organizational directory and
     personal Microsoft accounts*.
   - **Redirect URI**: platform **Single-page application (SPA)**, value =
     your site origin (e.g. `https://your-app.vercel.app`, plus
     `http://localhost:5173` for local dev).
2. Under **API permissions**, add Microsoft Graph → **Delegated** →
   `Notes.Read` and `User.Read`.
3. Copy the **Application (client) ID** and set it as an environment variable:
   - `VITE_MS_CLIENT_ID` = that client ID.
   Add it in **Vercel → Project Settings → Environment Variables** (and to a
   local `.env` for `npm run dev`), then redeploy.

The `Notes.Read` scope is read-only — Marginalia never modifies your OneNote
content. Auth happens entirely in the browser via MSAL; no client secret is
needed or stored.

## Notes persistence

Notes you edit, and generated podcast/sermon-insight results, are cached in
the browser's `localStorage` (see `src/lib/storage.js`), so they persist
across reloads on the same device/browser — but they aren't synced across
devices without a real backend.
