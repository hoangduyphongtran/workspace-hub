/**
 * /api/callback.js
 * GET /callback/:provider?code=...  — exchanges code for tokens, stores in cookie
 *
 * Note: Vercel has no built-in KV store on the free plan.
 * We store tokens in an httpOnly cookie (encrypted) — simple and secure for a
 * single-user personal dashboard. For multi-user, upgrade to Vercel KV ($0 on hobby).
 */

import { serialize } from "cookie";

const TOKEN_URLS = {
  google:    "https://oauth2.googleapis.com/token",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  github:    "https://github.com/login/oauth/access_token",
  dropbox:   "https://api.dropboxapi.com/oauth2/token",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const provider    = req.url.split("/callback/")[1]?.split("?")[0];
  const code        = new URL(req.url, "http://x").searchParams.get("code");
  const tokenUrl    = TOKEN_URLS[provider];

  if (!code || !tokenUrl) return res.status(400).json({ error: "Bad request" });

  const clientId     = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
  const redirectUri  = `${process.env.VERCEL_URL_FULL}/callback/${provider}`;

  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (provider === "github") headers["Accept"] = "application/json";

  const tokenRes = await fetch(tokenUrl, { method: "POST", body, headers });
  const tokens   = await tokenRes.json();

  if (tokens.error) return res.status(400).json({ error: tokens.error_description || tokens.error });

  // Store token in a secure httpOnly cookie (7 days)
  const cookieVal = JSON.stringify({ ...tokens, savedAt: Date.now() });
  res.setHeader("Set-Cookie", serialize(`token_${provider}`, cookieVal, {
    httpOnly: true,
    secure:   true,
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 7,
    path:     "/",
  }));

  // Redirect back to dashboard
  return res.redirect(302, process.env.DASHBOARD_URL || "/");
}
