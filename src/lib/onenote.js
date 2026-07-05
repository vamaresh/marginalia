import { PublicClientApplication } from "@azure/msal-browser";

/*
 * Real OneNote sync via Microsoft Graph.
 *
 * Requires an Azure AD app registration. Set its Application (client) ID as
 * VITE_MS_CLIENT_ID in your environment (e.g. Vercel env vars). The app must be
 * registered as a Single-page application (SPA) with a redirect URI equal to the
 * site origin, and granted the delegated Microsoft Graph permission "Notes.Read".
 */

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID;
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Notes.Read", "User.Read"];
const MAX_PAGES_PER_SECTION = 20;

export function isConfigured() {
  return Boolean(CLIENT_ID);
}

let msalInstance = null;
let initPromise = null;

async function getMsal() {
  if (!isConfigured()) {
    throw new Error(
      "OneNote sync isn't configured. Set VITE_MS_CLIENT_ID to your Azure app's client ID."
    );
  }
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "localStorage" },
    });
    initPromise = msalInstance.initialize();
  }
  await initPromise;
  return msalInstance;
}

/* Sign in (if needed) and return a Graph access token. */
export async function getAccessToken() {
  const msal = await getMsal();
  const existing = msal.getAllAccounts()[0];
  try {
    if (existing) {
      const res = await msal.acquireTokenSilent({ scopes: SCOPES, account: existing });
      return res.accessToken;
    }
  } catch (e) {
    /* fall through to interactive */
  }
  const res = await msal.acquireTokenPopup({ scopes: SCOPES });
  return res.accessToken;
}

export async function signOut() {
  const msal = await getMsal();
  const account = msal.getAllAccounts()[0];
  if (account) {
    await msal.clearCache({ account });
  }
}

async function graphGet(token, url, accept = "application/json") {
  const res = await fetch(url.startsWith("http") ? url : `${GRAPH}${url}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error?.message || "";
    } catch (e) {
      /* ignore */
    }
    throw new Error(`Graph request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return accept === "application/json" ? res.json() : res.text();
}

/*
 * Pull the user's notebooks, sections, pages and page HTML from Microsoft Graph
 * and shape them the way the Marginalia UI expects.
 */
export async function fetchOneNoteData(token, { colors = [] } = {}) {
  const nbResp = await graphGet(
    token,
    "/me/onenote/notebooks?$select=id,displayName&$orderby=displayName"
  );
  const notebooks = nbResp.value || [];

  const result = [];
  for (let i = 0; i < notebooks.length; i++) {
    const nb = notebooks[i];
    const secResp = await graphGet(
      token,
      `/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`
    );
    const sections = secResp.value || [];

    const shapedSections = [];
    for (const sec of sections) {
      const pageResp = await graphGet(
        token,
        `/me/onenote/sections/${sec.id}/pages?$select=id,title,lastModifiedDateTime&$top=${MAX_PAGES_PER_SECTION}&$orderby=lastModifiedDateTime desc`
      );
      const pages = pageResp.value || [];

      const shapedPages = [];
      for (const pg of pages) {
        let html = "";
        try {
          html = await graphGet(token, `/me/onenote/pages/${pg.id}/content`, "text/html");
        } catch (e) {
          html = "";
        }
        const cleanHtml = extractBodyHtml(html);
        shapedPages.push({
          id: `onenote-${pg.id}`,
          title: pg.title || "Untitled page",
          edited: formatEdited(pg.lastModifiedDateTime),
          html: cleanHtml,
          content: htmlToPlainParagraphs(cleanHtml),
        });
      }

      if (shapedPages.length) {
        shapedSections.push({
          id: `onenote-sec-${sec.id}`,
          name: sec.displayName || "Section",
          pages: shapedPages,
        });
      }
    }

    if (shapedSections.length) {
      result.push({
        id: `onenote-nb-${nb.id}`,
        name: nb.displayName || "Notebook",
        color: colors[i % colors.length] || "#5B4570",
        synced: true,
        sections: shapedSections,
      });
    }
  }

  return result;
}

/* Return only the inner <body> markup from a OneNote page HTML document. */
function extractBodyHtml(html) {
  if (!html) return "";
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = match ? match[1] : html;
  // OneNote wraps content in absolutely-positioned divs; strip inline styles so
  // the reader's own typography applies.
  return body.replace(/\sstyle="[^"]*"/gi, "").replace(/\sdata-id="[^"]*"/gi, "").trim();
}

function htmlToPlainParagraphs(html) {
  if (!html) return [""];
  const blocks = html.split(/<\/(?:p|div|h[1-6]|li)>/i);
  const paras = [];
  for (const chunk of blocks) {
    const text = chunk
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (text) paras.push(text);
  }
  return paras.length ? paras : [""];
}

function formatEdited(iso) {
  if (!iso) return "synced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "synced";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
