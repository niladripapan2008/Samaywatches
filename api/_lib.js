import { createHash, timingSafeEqual } from "node:crypto";

// Vercel may add a prefix (for example STORAGE_) to the variable names when a database is
// connected, so look for the names by their ending instead of an exact match.
const find = (...endings) => {
  for (const e of endings) {
    const k = Object.keys(process.env).find((n) => n === e || n.endsWith("_" + e));
    if (k && process.env[k]) return process.env[k];
  }
  return "";
};
const URL_ = () => find("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const TOK = () => find("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
export const blobToken = () => find("BLOB_READ_WRITE_TOKEN", "READ_WRITE_TOKEN");

export const hasRedis = () => !!(URL_() && TOK());
export const hasBlob = () => !!blobToken();
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
