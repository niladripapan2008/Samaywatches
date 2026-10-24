import { redis } from "./_lib.js";

const TYPES = new Set(["visit", "product", "contact", "cart"]);

// Public: counts a visit / click. Keeps the latest 5,000 events.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!TYPES.has(b.type)) return res.status(400).end();
    const ev = {
      t: Date.now(),
      type: b.type,
      ref: String(b.ref || "").slice(0, 80),
      vid: String(b.vid || "").slice(0, 40),
    };
    await redis(["LPUSH", "samay:events", JSON.stringify(ev)]);
    await redis(["LTRIM", "samay:events", 0, 4999]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).end();
  }
}
