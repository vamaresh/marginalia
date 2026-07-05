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
   - `ANTHROPIC_API_KEY` = your Anthropic API key (from console.anthropic.com)

   This key powers the `/api/claude` serverless function, which the app calls
   for **Turn into podcast** and **Sermon insights**. It never reaches the
   browser — only your server-side function sees it.
4. Deploy. Every push to your main branch will auto-redeploy.

## What's real vs. simulated

- **Reading, theming, editing, formatting, search** — fully real, runs entirely
  in the browser.
- **Listen (text-to-speech)** — real, uses the browser's built-in Web Speech
  API. Voice quality depends on the device/browser; works best in Chrome or
  Edge on desktop.
- **Turn into podcast / Sermon insights** — real Claude API calls via the
  `/api/claude` serverless function. Needs `ANTHROPIC_API_KEY` set as above.
- **Sync OneNote** — currently **simulated** with sample data, so you can see
  the intended flow. A real "Sign in with Microsoft" requires:
  1. Registering an app in Microsoft Entra ID (Azure Portal — free)
  2. Adding [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
     to handle the OAuth login
  3. Using the Microsoft Graph API's `/me/onenote/notebooks` endpoints to pull
     real notebooks/sections/pages
  This isn't wired up yet — happy to build it once you have a domain to
  register the app against (Entra ID requires a real redirect URL).

## Notes persistence

Notes you edit, and generated podcast/sermon-insight results, are cached in
the browser's `localStorage` (see `src/lib/storage.js`), so they persist
across reloads on the same device/browser — but they aren't synced across
devices without a real backend.
