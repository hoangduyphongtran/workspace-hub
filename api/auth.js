/**
 * /api/auth.js
 * GET /auth/:provider  — redirects user to provider login page
 */

const OAUTH_CONFIG = {
  google: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    scopes:   "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly",
  },
  microsoft: {
    authUrl:  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    scopes:   "offline_access Mail.Read Files.Read Calendars.Read",
  },
  github: {
    authUrl:  "https://github.com/login/oauth/authorize",
    scopes:   "repo notifications",
  },
  dropbox: {
    authUrl:  "https://www.dropbox.com/oauth2/authorize",
    scopes:   "",
  },
};

export default function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  // Extract provider from URL  e.g. /auth/google → google
  const provider = req.url.split("/auth/")[1]?.split("?")[0];
  const cfg = OAUTH_CONFIG[provider];
  if (!cfg) return res.status(400).json({ error: "Unknown provider" });

  const clientId     = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const redirectUri  = `${process.env.VERCEL_URL_FULL}/callback/${provider}`;
  const state        = Math.random().toString(36).slice(2);

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         cfg.scopes,
    state,
    access_type:   "offline",
    prompt:        "consent",
  });

  return res.redirect(302, `${cfg.authUrl}?${params}`);
}
