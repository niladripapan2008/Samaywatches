import { redis } from "./_lib.js";

// Serves photos that were stored in the database (used when Blob is not connected).
export default async function handler(req, res) {
  try {
    const id = String(req.query.id || "").replace(/[^a-z0-9]/gi, "");
    const v = id && (await redis(["GET", "samay:media:" + id]));
    if (!v) return res.status(404).end();
    const i = v.indexOf("|");
    res.setHeader("Content-Type", v.slice(0, i));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(Buffer.from(v.slice(i + 1), "base64"));
  } catch (e) {
    res.status(500).end();
  }
}
