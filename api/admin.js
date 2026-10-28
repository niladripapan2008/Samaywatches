import { isOwner, hasPass } from "./_lib.js";

// Owner-only gateway to the Google Sheet database.
// The browser sends the owner passcode; this function adds the secret ADMIN_KEY and forwards to Apps Script,
// so the sheet's admin key is never visible in the browser.
const ALLOWED = new Set(["adminLoad", "adminUpdate", "adminAdd", "adminDelete"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasPass()) return res.status(503).json({ ok: false, error: "OWNER_PASSCODE is not set in Vercel." });
  if (!isOwner(req)) return res.status(401).json({ ok: false, error: "Wrong passcode." });

  const url = process.env.APPS_SCRIPT_URL, key = process.env.APPS_SCRIPT_ADMIN_KEY;
  if (!url || !key)
    return res.status(503).json({ ok: false, error: "Add APPS_SCRIPT_URL and APPS_SCRIPT_ADMIN_KEY in Vercel (Settings > Environment Variables), then redeploy." });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!ALLOWED.has(b.action)) return res.status(400).json({ ok: false, error: "Unknown action." });
    const r = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...b, adminKey: key }),
    });
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch (e) { return res.status(502).json({ ok: false, error: "The Google Sheet script did not answer correctly. Check the Apps Script deployment (Access: Anyone) and APPS_SCRIPT_URL." }); }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(j);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
