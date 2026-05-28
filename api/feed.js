/**
 * /api/feed.js
 * GET /api/feed/:appId  — returns live feed data for a given app
 */

import { parse } from "cookie";

/* ── Token helpers ── */
function getToken(req, provider) {
  const cookies = parse(req.headers.cookie || "");
  const raw     = cookies[`token_${provider}`];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function refreshGoogleToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  });
  const res  = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  return res.json();
}

async function refreshMsToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", body });
  return res.json();
}

function isExpired(tokens) {
  const expiresAt = (tokens.savedAt || 0) + (tokens.expires_in || 3600) * 1000;
  return Date.now() > expiresAt - 60_000;
}

async function getValidAccessToken(req, res, provider) {
  const tokens = getToken(req, provider);
  if (!tokens?.access_token) return null;
  if (!isExpired(tokens)) return tokens.access_token;

  let fresh = null;
  const cid = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const cs  = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];

  if (provider === "google" && tokens.refresh_token) {
    fresh = await refreshGoogleToken(cid, cs, tokens.refresh_token);
  } else if (provider === "microsoft" && tokens.refresh_token) {
    fresh = await refreshMsToken(cid, cs, tokens.refresh_token);
  }

  if (fresh?.access_token) {
    const { serialize } = await import("cookie");
    const updated = JSON.stringify({ ...tokens, ...fresh, savedAt: Date.now() });
    res.setHeader("Set-Cookie", serialize(`token_${provider}`, updated, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
    }));
    return fresh.access_token;
  }
  return null;
}

/* ── API call helper ── */
async function callApi(url, token, extraHeaders = {}) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extraHeaders },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/* ── Data fetchers ── */

// Gmail: unread emails with clickable links
async function fetchGmail(token) {
  const list = await callApi(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is:unread", token
  );
  if (!list.messages?.length) return [{ dot:"d-green", text:"No unread emails", meta:"Inbox is clear" }];
  const msgs = await Promise.all(
    list.messages.slice(0, 3).map(m =>
      callApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject,From,Date`, token)
    )
  );
  return msgs.map(m => {
    const h       = m.payload?.headers || [];
    const subject = h.find(x => x.name === "Subject")?.value || "(no subject)";
    const from    = h.find(x => x.name === "From")?.value || "";
    const date    = h.find(x => x.name === "Date")?.value || "";
    const name    = from.replace(/<.*>/, "").trim() || from;
    const time    = date ? new Date(date).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
    return {
      dot:  "d-blue",
      text: subject.slice(0, 58),
      meta: `${name.slice(0, 30)} · ${time}`,
      tag:  "new",
      url:  `https://mail.google.com/mail/u/0/#inbox/${m.id}`,
    };
  });
}

// Google Drive: recent files with clickable links
async function fetchGDrive(token) {
  const data = await callApi(
    "https://www.googleapis.com/drive/v3/files?pageSize=5&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,trashed,webViewLink)", token
  );
  return (data.files || []).slice(0, 3).map(f => ({
    dot:  f.trashed ? "d-red" : "d-green",
    text: f.name,
    meta: f.trashed
      ? `Deleted · ${new Date(f.modifiedTime).toLocaleDateString()}`
      : `Updated · ${new Date(f.modifiedTime).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`,
    tag: f.trashed ? "del" : "new",
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
  }));
}

// Google Calendar: upcoming events with clickable links
async function fetchGCal(token) {
  const now = new Date().toISOString();
  const data = await callApi(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=3&orderBy=startTime&singleEvents=true&timeMin=${now}`, token
  );
  return (data.items || []).map(e => {
    const start = e.start?.dateTime || e.start?.date || "";
    return {
      dot:  "d-green",
      text: (e.summary || "(no title)").slice(0, 55),
      meta: new Date(start).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }),
      url:  e.htmlLink || "https://calendar.google.com",
    };
  });
}

// Outlook: unread emails with clickable links
async function fetchOutlook(token) {
  const data = await callApi(
    "https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$top=3&$select=id,subject,from,receivedDateTime,webLink", token
  );
  return (data.value || []).map(m => ({
    dot:  "d-blue",
    text: (m.subject || "(no subject)").slice(0, 58),
    meta: (m.from?.emailAddress?.name || "").slice(0, 40),
    tag:  "new",
    url:  m.webLink || "https://outlook.live.com",
  }));
}

// OneDrive: recent files with clickable links
async function fetchOneDrive(token) {
  const data = await callApi("https://graph.microsoft.com/v1.0/me/drive/recent?$top=5", token);
  return (data.value || []).slice(0, 3).map(f => ({
    dot:  "d-green",
    text: f.name,
    meta: `Updated · ${new Date(f.lastModifiedDateTime).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}`,
    tag:  "new",
    url:  f.webUrl || "https://onedrive.live.com",
  }));
}

// MS Calendar: upcoming events with clickable links
async function fetchMsCal(token) {
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 7 * 86400000).toISOString();
  const data = await callApi(
    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${now}&endDateTime=${end}&$top=3&$select=subject,start,webLink`, token
  );
  return (data.value || []).map(e => ({
    dot:  "d-green",
    text: (e.subject || "(no title)").slice(0, 55),
    meta: new Date(e.start?.dateTime).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }),
    url:  e.webLink || "https://outlook.live.com/calendar",
  }));
}

// Teams: recent chats
async function fetchTeams(token) {
  const data = await callApi(
    "https://graph.microsoft.com/v1.0/me/chats?$top=3&$expand=lastMessagePreview", token
  );
  return (data.value || []).slice(0, 3).map(c => ({
    dot:  "d-blue",
    text: c.lastMessagePreview?.body?.content?.slice(0, 55) || "New message",
    meta: c.topic || "Teams chat",
    tag:  "new",
    url:  `https://teams.microsoft.com/l/chat/${c.id}/0`,
  }));
}

// GitHub: PRs and issues with clickable links
async function fetchGitHub(token) {
  const [prs, issues] = await Promise.all([
    callApi("https://api.github.com/search/issues?q=is:pr+is:open+author:@me&per_page=2", token, { "User-Agent":"workspace-hub" }),
    callApi("https://api.github.com/issues?filter=created&state=open&per_page=2", token, { "User-Agent":"workspace-hub" }),
  ]);
  const out = [];
  (prs.items || []).slice(0, 2).forEach(p => out.push({
    dot: "d-blue", text: p.title.slice(0,55),
    meta: `PR · ${p.repository_url?.split("/").pop()}`,
    tag: "new", url: p.html_url,
  }));
  (issues || []).slice(0, 1).forEach(i => out.push({
    dot: "d-amber", text: i.title.slice(0,55),
    meta: `Issue · ${i.repository_url?.split("/").pop()}`,
    tag: "warn", url: i.html_url,
  }));
  return out.slice(0, 3);
}

// Dropbox: recent files
async function fetchDropbox(token) {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify({ path:"", limit:5 }),
  });
  const data = await res.json();
  return (data.entries || []).slice(0, 3).map(f => ({
    dot:  f[".tag"] === "deleted" ? "d-red" : "d-green",
    text: f.name,
    meta: f[".tag"] === "deleted" ? "Deleted" : "Updated recently",
    tag:  f[".tag"] === "deleted" ? "del" : "new",
    url:  "https://www.dropbox.com/home",
  }));
}

/* ── Route map ── */
const ROUTES = {
  gmail:      { provider:"google",    fn: fetchGmail },
  gcal:       { provider:"google",    fn: fetchGCal },
  gdrive:     { provider:"google",    fn: fetchGDrive },
  outlook:    { provider:"microsoft", fn: fetchOutlook },
  mscal:      { provider:"microsoft", fn: fetchMsCal },
  onedrive:   { provider:"microsoft", fn: fetchOneDrive },
  teams:      { provider:"microsoft", fn: fetchTeams },
  msproject:  { provider:"microsoft", fn: fetchMsCal },
  github:     { provider:"github",    fn: fetchGitHub },
  dropbox:    { provider:"dropbox",   fn: fetchDropbox },
};

/* ── Handler ── */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const appId   = req.url.split("/api/feed/")[1]?.split("?")[0];
  const route   = ROUTES[appId];
  if (!route) return res.status(404).json({ error: "Unknown app" });

  const token = await getValidAccessToken(req, res, route.provider);
  if (!token)  return res.status(200).json({ connected: false, items: [] });

  try {
    const items = await route.fn(token);
    return res.status(200).json({ connected: true, items });
  } catch (e) {
    console.error(`[feed/${appId}]`, e.message);
    return res.status(200).json({ connected: false, items: [], error: e.message });
  }
}
