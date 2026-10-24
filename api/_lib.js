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
const REDIS_URL = () => find("REDIS_URL", "KV_URL");
export const blobToken = () => find("BLOB_READ_WRITE_TOKEN", "READ_WRITE_TOKEN");

export const hasRest = () => !!(URL_() && TOK());
export const hasTcp = () => /^rediss?:\/\//.test(REDIS_URL());
export const hasRedis = () => hasRest() || hasTcp();
export const hasBlob = () => !!(blobToken() || find("BLOB_STORE_ID"));
export const hasPass = () => !!process.env.OWNER_PASSCODE;

let tcp; // one shared connection per running function
async function tcpClient() {
  if (!tcp) {
    tcp = (async () => {
      const { createClient } = await import("redis");
      const c = createClient({ url: REDIS_URL(), socket: { connectTimeout: 6000 } });
      c.on("error", () => { tcp = null; });
      await c.connect();
      return c;
    })();
    tcp.catch(() => { tcp = null; });
  }
  return tcp;
}

export async function redis(cmd) {
  if (!hasRedis()) throw new Error("Database not connected. In Vercel open Storage, create a Redis database and connect it to this project, then redeploy.");
  if (hasRest()) {
    const r = await fetch(URL_(), {
      method: "POST",
      headers: { Authorization: "Bearer " + TOK() },
      body: JSON.stringify(cmd),
    });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error("Database error: " + j.error);
    return j.result;
  }
  const c = await tcpClient();
  return c.sendCommand(cmd.map(String));
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
