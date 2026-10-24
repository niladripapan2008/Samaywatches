import { hasRedis, hasBlob, hasPass, redis } from "./_lib.js";

// Open  https://your-site.vercel.app/api/health  to check the setup. No secrets are shown.
export default async function handler(req, res) {
  const out = {
    api_running: true,
    OWNER_PASSCODE_set: hasPass(),
    database_connected: hasRedis(),
    database_reachable: false,
    saved_content_found: false,
    blob_storage_connected: hasBlob(),
    storage_variable_names_found: Object.keys(process.env).filter((n) => /KV_|REDIS|UPSTASH|BLOB|READ_WRITE|STORAGE/i.test(n)),
  };
  if (hasRedis()) {
    try {
      await redis(["PING"]);
      out.database_reachable = true;
      out.saved_content_found = !!(await redis(["EXISTS", "samay:state"]));
    } catch (e) {
      out.database_error = String(e.message || e);
    }
  }
  const todo = [];
  if (!out.OWNER_PASSCODE_set) todo.push("Add the OWNER_PASSCODE environment variable, then redeploy.");
  if (!out.database_connected) todo.push("Create and connect an Upstash Redis database (Storage tab), then redeploy.");
  if (!out.blob_storage_connected) todo.push("Optional but recommended: connect a Blob store (needed for videos and large photos).");
  out.todo = todo;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
}
