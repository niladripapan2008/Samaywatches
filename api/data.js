import { redis } from "./_lib.js";

// Public: the website reads its saved content from here.
export default async function handler(req, res) {
  try {
    const v = await redis(["GET", "samay:state"]);
    res.setHeader("Cache-Control", "public, s-maxage=3, stale-while-revalidate=20");
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(v || "null");
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(null); // site falls back to its built-in content
  }
}
