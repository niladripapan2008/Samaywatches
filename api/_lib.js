import { createHash, timingSafeEqual } from "node:crypto";

const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = () => !!(URL_() && TOK());
export const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const hasPass = () => !!process.env.OWNER_PASSCODE;

export async function redis(cmd) {
  if (!hasRedis()) throw new Error("Database not connected. In Vercel open Storage, create an Upstash Redis database and connect it to this project, then redeploy.");
  const r = await fetch(URL_(), {
    method: "POST",
    headers: { Authorization: "Bearer " + TOK() },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error("Database error: " + j.error);
  return j.result;
}

const sha = (s) => createHash("sha256").update(String(s)).digest();

export function isOwner(req) {
  const given = req.headers["x-owner-pass"] || "";
  const real = process.env.OWNER_PASSCODE || "";
  if (!real || !given) return false;
  return timingSafeEqual(sha(given), sha(real));
}

export async function readRaw(req, max = 4.4 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw Object.assign(new Error("File is too large (limit 4 MB)."), { code: 413 });
    chunks.push(c);
  }
  let buf = Buffer.concat(chunks);
  if (!buf.length && Buffer.isBuffer(req.body)) buf = req.body;
  return buf;
}
