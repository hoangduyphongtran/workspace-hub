/**
 * /api/status.js
 * GET /api/status  — returns which providers have active tokens
 */
import { parse, serialize } from "cookie";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const cookies   = parse(req.headers.cookie || "");
  const providers = ["google", "microsoft", "github", "dropbox"];
  const status    = {};

  for (const p of providers) {
    try {
      const raw = cookies[`token_${p}`];
      status[p] = !!(raw && JSON.parse(raw).access_token);
    } catch {
      status[p] = false;
    }
  }

  return res.status(200).json(status);
}
