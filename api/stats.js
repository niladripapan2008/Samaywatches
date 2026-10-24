import { redis, isOwner } from "./_lib.js";

export default async function handler(req, res) {
  if (!isOwner(req)) return res.status(401).json({ ok: false });
  try {
    const rows = await redis(["LRANGE", "samay:events", 0, 999]);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ events: (rows || []).map((r) => JSON.parse(r)) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
