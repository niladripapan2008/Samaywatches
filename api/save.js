import { redis, isOwner, hasPass } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasPass()) return res.status(503).json({ error: "OWNER_PASSCODE is not set in Vercel." });
  if (!isOwner(req)) return res.status(401).json({ ok: false });
  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (body.length < 5 || body === "{}") return res.status(400).json({ error: "Nothing to save." });
    if (/"data:(image|video)\//.test(body)) return res.status(400).json({ error: "A photo or video was not uploaded first." });
    if (body.length > 900000) return res.status(413).json({ error: "The website content is too big for the database (" + Math.round(body.length / 1000) + " KB, limit 900 KB)." });
    await redis(["SET", "samay:state", body]);
    res.status(200).json({ ok: true, bytes: body.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
