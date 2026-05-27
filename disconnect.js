/**
 * /api/disconnect.js
 * POST /api/disconnect/:provider  — clears the provider's token cookie
 */
import { serialize } from "cookie";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const provider = req.url.split("/api/disconnect/")[1]?.split("?")[0];
  if (!provider)  return res.status(400).json({ error: "Missing provider" });

  res.setHeader("Set-Cookie", serialize(`token_${provider}`, "", {
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: 0, path: "/",
  }));

  return res.status(200).json({ disconnected: provider });
}
