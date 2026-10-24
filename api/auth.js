import { isOwner, hasPass } from "./_lib.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasPass())
    return res.status(503).json({ ok: false, error: "OWNER_PASSCODE is not set in Vercel (Settings > Environment Variables)." });
  if (!isOwner(req)) return res.status(401).json({ ok: false });
  res.status(200).json({ ok: true });
}
