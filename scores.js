// Vercel Serverless Function — live World Cup scores proxy
// =========================================================
// The browser calls /api/scores (same origin → no CORS, no key exposed).
// This function adds your FREE football-data.org token (stored as a Vercel
// Environment Variable named FD_TOKEN) and returns all World Cup 2026 matches.
//
// It also caches the upstream response in memory for ~45s so many visitors
// share one upstream call, staying well inside the free 10-requests/minute tier.

let cache = { at: 0, body: null };

export default async function handler(req, res) {
  // CORS (harmless when same-origin; useful if you ever call from elsewhere)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.FD_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "FD_TOKEN env var not set", matches: [] });
  }

  // Serve cached body if fresh (≤45s old)
  if (cache.body && Date.now() - cache.at < 45000) {
    res.setHeader("Cache-Control", "public, max-age=30");
    return res.status(200).json(cache.body);
  }

  try {
    const upstream = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": token } }
    );
    const data = await upstream.json();
    if (upstream.ok) {
      cache = { at: Date.now(), body: data };
    }
    res.setHeader("Cache-Control", "public, max-age=30");
    return res.status(upstream.status).json(data);
  } catch (err) {
    // On a transient upstream error, serve last good cache if we have it
    if (cache.body) return res.status(200).json(cache.body);
    return res.status(502).json({ error: "upstream fetch failed", matches: [] });
  }
}
