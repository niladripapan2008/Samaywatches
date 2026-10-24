import { isOwner, readRaw, redis, hasBlob, hasRedis, hasPass } from "./_lib.js";

const OK = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

// Photos/videos go to Vercel Blob when it is connected.
// If Blob is not connected, small photos (up to ~600 KB) are kept in the database instead.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasPass()) return res.status(503).json({ error: "OWNER_PASSCODE is not set in Vercel." });
  if (!isOwner(req)) return res.status(401).json({ ok: false });
  try {
    const type = String(req.query.type || "");
    const ext = OK[type];
    if (!ext) return res.status(400).json({ error: "Unsupported file type: " + type });
    const buf = await readRaw(req);
    if (!buf.length) return res.status(400).json({ error: "The file arrived empty. Please try again." });

    if (hasBlob()) {
      const { put } = await import("@vercel/blob");
      const blob = await put("samay/media." + ext, buf, { access: "public", contentType: type, addRandomSuffix: true });
      return res.status(200).json({ url: blob.url });
    }
    if (type.startsWith("image/") && hasRedis() && buf.length <= 600 * 1024) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await redis(["SET", "samay:media:" + id, type + "|" + buf.toString("base64")]);
      return res.status(200).json({ url: "/api/media?id=" + id });
    }
    return res.status(503).json({
      error: type.startsWith("video/")
        ? "Videos need Blob storage. In Vercel open Storage, create a Blob store, connect it to this project and redeploy."
        : "This photo is large and Blob storage is not connected. Connect a Blob store in Vercel (Storage tab) and redeploy.",
    });
  } catch (e) {
    res.status(e.code === 413 ? 413 : 500).json({ error: String(e.message || e) });
  }
}
