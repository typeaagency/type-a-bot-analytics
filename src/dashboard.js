// The self-host dashboard: one Worker with a D1 database.
//   POST /hit  takes a hit from the rule (Bearer HIT_TOKEN) and counts it.
//   GET  /     the page: AI bot visits by group, link shares by app, the top
//              pages (HTTP Basic, the password is DASHBOARD_PASSWORD).
import { CONTRACT, classify } from "./match.js";
import { page } from "./page.js";

const PERIODS = [7, 30, 90];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/hit") {
      if (request.method !== "POST") return text(405, "POST only");
      return takeHit(request, env);
    }
    if (url.pathname === "/") {
      if (request.method !== "GET" && request.method !== "HEAD") return text(405, "GET only");
      return showPage(request, env, url);
    }
    return text(404, "Not found");
  },
};

async function takeHit(request, env) {
  if (!env.HIT_TOKEN) return text(503, "Set the HIT_TOKEN secret first");
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!(await same(given, env.HIT_TOKEN))) return text(401, "Wrong hit token");

  let hit;
  try {
    hit = await request.json();
  } catch {
    return text(400, "The body is not JSON");
  }
  if (!hit || hit.contract !== CONTRACT) return text(400, `The contract must be ${CONTRACT}`);
  const host = String(hit.host || "").toLowerCase();
  const path = String(hit.path || "");
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return text(400, "Bad host");
  if (!path.startsWith("/") || path.length > 1024) return text(400, "Bad path");

  // The dashboard names the visit itself, from the user agent.
  const visit = classify(hit.user_agent);
  if (!visit) return text(422, "The user agent is no counted bot or app");

  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO visits (day, kind, name, grp, host, path, hits) VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT (day, kind, name, host, path) DO UPDATE SET hits = hits + 1`,
  )
    .bind(day, visit.kind, visit.name, visit.group, host, path)
    .run();
  return text(202, "Counted");
}

async function showPage(request, env, url) {
  if (!env.DASHBOARD_PASSWORD) return text(503, "Set the DASHBOARD_PASSWORD secret first");
  if (!(await signedIn(request, env.DASHBOARD_PASSWORD))) {
    return new Response("Sign in", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Bot Analytics"' } });
  }

  const days = PERIODS.includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const all = (sql) =>
    env.DB.prepare(sql)
      .bind(since)
      .all()
      .then((answer) => answer.results);
  const [agents, apps, pages] = await Promise.all([
    all(`SELECT grp, name, SUM(hits) AS hits FROM visits WHERE kind = 'ai_bot' AND day >= ?
         GROUP BY grp, name ORDER BY hits DESC, name`),
    all(`SELECT name, SUM(hits) AS hits FROM visits WHERE kind = 'link_share' AND day >= ?
         GROUP BY name ORDER BY hits DESC, name`),
    all(`SELECT host, path, SUM(CASE WHEN kind = 'ai_bot' THEN hits ELSE 0 END) AS bots,
                SUM(CASE WHEN kind = 'link_share' THEN hits ELSE 0 END) AS shares
         FROM visits WHERE day >= ? GROUP BY host, path ORDER BY bots + shares DESC, host, path LIMIT 20`),
  ]);
  return new Response(page({ days, since, agents, apps, pages }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function signedIn(request, password) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let pair;
  try {
    pair = atob(header.slice(6));
  } catch {
    return false;
  }
  return same(pair.slice(pair.indexOf(":") + 1), password);
}

// Compares two strings in a time that does not depend on where they differ.
async function same(a, b) {
  const digest = (value) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [x, y] = (await Promise.all([digest(a), digest(b)])).map((buffer) => new Uint8Array(buffer));
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}

function text(status, body) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
